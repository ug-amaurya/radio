import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { createSession, getRoom, snapshot } from "../services/sessionRooms.js";

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

// Playback driven by a track list rather than a saved station has no station id.
const startBody = z.object({ stationId: z.string().min(1).default("adhoc") });

export const sessionsRouter = Router();
sessionsRouter.use(requireAuth);

sessionsRouter.post(
  "/",
  wrap(async (req, res) => {
    const body = startBody.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "Invalid session request" });
      return;
    }
    const session = await createSession(req.user!.id, body.data.stationId);
    res.status(201).json({ session: { joinCode: session.joinCode, stationId: session.stationId } });
  }),
);

sessionsRouter.get(
  "/:joinCode",
  wrap(async (req, res) => {
    const joinCode = req.params.joinCode!.toUpperCase();
    const room = await getRoom(joinCode);
    if (!room) {
      res.status(404).json({ error: "This listening session has ended or doesn't exist" });
      return;
    }
    const host = await prisma.user.findUnique({ where: { id: room.hostUserId } });
    res.json({ session: { joinCode, hostHandle: host?.handle ?? "host", ...snapshot(room) } });
  }),
);
