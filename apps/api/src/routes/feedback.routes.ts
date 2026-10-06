import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { requireAuth } from "../middleware/requireAuth.js";

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

const MAX_BATCH = 100;

const feedbackBody = z.object({
  trackId: z.string().min(1),
  /** 1 = thumbs up, -1 = thumbs down, 0 = clear the rating. */
  rating: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
  genre: z.string().max(80).nullish(),
});

export const feedbackRouter = Router();
feedbackRouter.use(requireAuth);

feedbackRouter.post(
  "/",
  wrap(async (req, res) => {
    const body = feedbackBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "trackId and a rating of 1, -1 or 0 are required" });
      return;
    }
    const { trackId, rating, genre } = body.data;
    const userId = req.user!.id;

    if (rating === 0) {
      await prisma.trackFeedback.deleteMany({ where: { userId, trackId } });
    } else {
      await prisma.trackFeedback.upsert({
        where: { userId_trackId: { userId, trackId } },
        create: { userId, trackId, rating, genre: genre ?? null },
        update: { rating, genre: genre ?? null, createdAt: new Date() },
      });
    }
    res.status(204).end();
  }),
);

feedbackRouter.get(
  "/",
  wrap(async (req, res) => {
    const trackIds = String(req.query.trackIds ?? "")
      .split(",")
      .filter(Boolean)
      .slice(0, MAX_BATCH);
    const rows = await prisma.trackFeedback.findMany({ where: { userId: req.user!.id, trackId: { in: trackIds } } });
    res.json({ ratings: Object.fromEntries(rows.map((r) => [r.trackId, r.rating])) });
  }),
);
