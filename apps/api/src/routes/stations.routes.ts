import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { isGuestUser } from "../lib/guest.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { interleaveDiscover, loadDiscoverPool } from "../services/discover.js";
import { getProvider } from "../providers/index.js";
import { pickQueue } from "../services/stationEngine.js";
import { loadStationPool } from "../services/stationSource.js";
import { MAX_STATIONS_PER_USER, stationBody, stationPatchBody } from "../services/stationSchema.js";

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

const historyBody = z.object({
  trackId: z.string().min(1),
  stationId: z.string().nullish(),
  skipped: z.boolean().default(false),
  msPlayed: z.number().int().nonnegative().nullish(),
});

const QUICK_SKIP_MS = 10_000;
const DISCOVER_EVERY = 5;

export const stationsRouter = Router();
export const historyRouter = Router();
stationsRouter.use(requireAuth);
historyRouter.use(requireAuth);

stationsRouter.get(
  "/",
  wrap(async (req, res) => {
    res.json({ stations: await prisma.station.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "asc" } }) });
  }),
);

stationsRouter.post(
  "/",
  wrap(async (req, res) => {
    const body = stationBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid station" });
      return;
    }
    if (body.data.sourceType === "audius_favorites" && isGuestUser(req.user!)) {
      res.status(403).json({ error: "Log in with Audius to use favorites stations" });
      return;
    }
    const existing = await prisma.station.findMany({ where: { userId: req.user!.id }, select: { name: true } });
    if (existing.length >= MAX_STATIONS_PER_USER) {
      res.status(409).json({ error: `You can have up to ${MAX_STATIONS_PER_USER} stations. Delete one first.` });
      return;
    }
    if (existing.some((s) => s.name.toLowerCase() === body.data.name.toLowerCase())) {
      res.status(409).json({ error: "You already have a station with that name" });
      return;
    }
    const station = await prisma.station.create({
      data: { ...body.data, mood: body.data.mood ?? null, sourceRefs: body.data.sourceRefs, userId: req.user!.id },
    });
    res.status(201).json({ station });
  }),
);

stationsRouter.patch(
  "/:id",
  wrap(async (req, res) => {
    const patch = stationPatchBody.safeParse(req.body);
    if (!patch.success) {
      res.status(400).json({ error: patch.error.issues[0]?.message ?? "Invalid station" });
      return;
    }
    const current = await prisma.station.findFirst({ where: { id: req.params.id!, userId: req.user!.id } });
    if (!current) {
      res.status(404).json({ error: "Station not found" });
      return;
    }
    // Validate the station as it would look after the update, so cross-field rules still hold.
    const merged = stationBody.safeParse({
      name: current.name,
      mood: current.mood,
      sourceType: current.sourceType,
      sourceRefs: current.sourceRefs,
      djMode: current.djMode,
      crossfadeSec: current.crossfadeSec,
      discoverMode: current.discoverMode,
      ...patch.data,
    });
    if (!merged.success) {
      res.status(400).json({ error: merged.error.issues[0]?.message ?? "Invalid station" });
      return;
    }
    if (merged.data.sourceType === "audius_favorites" && isGuestUser(req.user!)) {
      res.status(403).json({ error: "Log in with Audius to use favorites stations" });
      return;
    }
    if (patch.data.name !== undefined) {
      const others = await prisma.station.findMany({
        where: { userId: req.user!.id, NOT: { id: current.id } },
        select: { name: true },
      });
      if (others.some((s) => s.name.toLowerCase() === merged.data.name.toLowerCase())) {
        res.status(409).json({ error: "You already have a station with that name" });
        return;
      }
    }
    const station = await prisma.station.update({
      where: { id: current.id },
      data: { ...merged.data, mood: merged.data.mood ?? null },
    });
    res.json({ station });
  }),
);

stationsRouter.delete(
  "/:id",
  wrap(async (req, res) => {
    const { count } = await prisma.station.deleteMany({ where: { id: req.params.id!, userId: req.user!.id } });
    res.status(count ? 204 : 404).end();
  }),
);

stationsRouter.get(
  "/:id/queue",
  wrap(async (req, res) => {
    const user = req.user!;
    const station = await prisma.station.findFirst({ where: { id: req.params.id!, userId: user.id } });
    if (!station) {
      res.status(404).json({ error: "Station not found" });
      return;
    }
    const count = Math.min(Math.max(Number(req.query.count) || 10, 1), 50);

    const [pool, recent, feedback] = await Promise.all([
      loadStationPool(station, user.audiusUserId),
      prisma.listenEvent.findMany({ where: { userId: user.id }, orderBy: { playedAt: "desc" }, take: 100 }),
      prisma.trackFeedback.findMany({ where: { userId: user.id } }),
    ]);

    const recentIds = [...new Set(recent.map((e) => e.trackId))];
    const ratings = new Map(feedback.map((f) => [f.trackId, f.rating]));
    const quickSkipIds = new Set(
      recent.filter((e) => e.skipped && (e.msPlayed ?? 0) < QUICK_SKIP_MS).map((e) => e.trackId),
    );

    let tracks = pickQueue({ pool, recentIds, ratings, quickSkipIds, count });

    if (station.discoverMode) {
      // Every DISCOVER_EVERY-th slot comes from outside the station's own pool.
      const poolIds = new Set(pool.map((t) => t.id));
      const candidates = (await loadDiscoverPool(getProvider(), pool, feedback)).filter((t) => !poolIds.has(t.id));
      const discover = pickQueue({
        pool: candidates,
        recentIds,
        ratings,
        quickSkipIds,
        count: Math.floor(count / DISCOVER_EVERY),
      });
      tracks = interleaveDiscover(tracks, discover, DISCOVER_EVERY);
    }
    res.json({ tracks });
  }),
);

historyRouter.post(
  "/",
  wrap(async (req, res) => {
    const body = historyBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid listen event" });
      return;
    }
    await prisma.listenEvent.create({
      data: { ...body.data, stationId: body.data.stationId ?? null, msPlayed: body.data.msPlayed ?? null, userId: req.user!.id },
    });
    res.status(204).end();
  }),
);

historyRouter.get(
  "/recent",
  wrap(async (req, res) => {
    const events = await prisma.listenEvent.findMany({ where: { userId: req.user!.id }, orderBy: { playedAt: "desc" }, take: 50 });
    res.json({ trackIds: [...new Set(events.map((e) => e.trackId))] });
  }),
);
