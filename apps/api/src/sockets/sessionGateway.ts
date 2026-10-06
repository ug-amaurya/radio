import type { Server as HttpServer } from "node:http";
import type { RequestHandler } from "express";
import { Server, type Socket } from "socket.io";
import { z } from "zod";
import { env } from "../env.js";
import { activeRooms, endSession, getRoom, setTrack, snapshot } from "../services/sessionRooms.js";
import { verifySocketToken } from "../services/socketToken.js";
import { positionMs } from "../services/sessionClock.js";

const RESYNC_INTERVAL_MS = 20_000;
const MAX_UPCOMING = 10;

// Real Audius tracks carry nulls for missing fields (e.g. mood), so optional text fields accept null.
const optionalText = z
  .string()
  .nullish()
  .transform((v) => v ?? undefined);

export const trackSchema = z.object({
  id: z.string().min(1),
  provider: z.enum(["audius", "local"]),
  title: z.string(),
  artist: z.string(),
  artworkUrl: optionalText,
  artworkFallbacks: z.array(z.string()).max(10).nullish().transform((v) => v ?? undefined),
  durationSec: z.number(),
  genre: optionalText,
  mood: optionalText,
  permalinkUrl: optionalText,
});
const joinSchema = z.object({ joinCode: z.string().min(1) });
const trackChangeSchema = z.object({
  track: trackSchema,
  upNext: z.array(trackSchema).max(MAX_UPCOMING).default([]),
  /** How far into the track the host already is when it reports the change (audio takes a moment to start). */
  positionMs: z.number().min(0).default(0),
});

interface SocketData {
  userId?: string;
  joinCode?: string;
  isHost?: boolean;
}

type Ack = (response: { ok: boolean; error?: string; [key: string]: unknown }) => void;

/**
 * Real-time "listen together" rooms. The server owns the clock: it records when each
 * track started, tells joiners how far in they are, and periodically broadcasts the
 * position so listeners can correct drift. Sockets authenticate with the HTTP session cookie.
 */
export function attachSessionGateway(httpServer: HttpServer, sessionMiddleware: RequestHandler) {
  const io = new Server<Record<string, never>, Record<string, never>, Record<string, never>, SocketData>(httpServer, {
    cors: { origin: env.FRONTEND_ORIGIN, credentials: true },
  });

  io.engine.use(sessionMiddleware);

  const broadcastListeners = async (joinCode: string) => {
    const sockets = await io.in(joinCode).fetchSockets();
    io.to(joinCode).emit("session:listeners", { count: sockets.length });
  };

  io.on("connection", (socket: Socket) => {
    const data = socket.data as SocketData;
    const req = socket.request as typeof socket.request & { session?: { userId?: string } };
    // The token is how production connects (cross-domain, no cookie); the cookie covers local dev.
    data.userId = verifySocketToken(socket.handshake.auth?.token) ?? req.session?.userId;

    socket.on("session:join", async (payload: unknown, ack?: Ack) => {
      const parsed = joinSchema.safeParse(payload);
      if (!data.userId) return ack?.({ ok: false, error: "Not authenticated" });
      if (!parsed.success) return ack?.({ ok: false, error: "joinCode is required" });

      const joinCode = parsed.data.joinCode.toUpperCase();
      const room = await getRoom(joinCode);
      if (!room) return ack?.({ ok: false, error: "This listening session has ended or doesn't exist" });

      data.joinCode = joinCode;
      data.isHost = room.hostUserId === data.userId;
      await socket.join(joinCode);
      ack?.({ ok: true, isHost: data.isHost, state: snapshot(room) });
      void broadcastListeners(joinCode);
    });

    // Only the host drives the room: a new track means the clock restarts at 0.
    socket.on("session:track-change", async (payload: unknown, ack?: Ack) => {
      if (!data.isHost || !data.joinCode) return ack?.({ ok: false, error: "Only the host can change tracks" });
      const parsed = trackChangeSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: "Invalid track" });

      const room = await setTrack(
        data.joinCode,
        parsed.data.track,
        parsed.data.upNext,
        Date.now() - parsed.data.positionMs,
      );
      if (!room) return ack?.({ ok: false, error: "Session ended" });
      socket.to(data.joinCode).emit("session:track-change", snapshot(room));
      ack?.({ ok: true });
    });

    socket.on("session:end", async () => {
      if (!data.isHost || !data.joinCode) return;
      const joinCode = data.joinCode;
      await endSession(joinCode);
      io.to(joinCode).emit("session:ended");
      io.in(joinCode).socketsLeave(joinCode);
    });

    socket.on("disconnect", () => {
      if (data.joinCode) void broadcastListeners(data.joinCode);
    });
  });

  // Drift correction: tell every room where it should be.
  const resync = setInterval(() => {
    const now = Date.now();
    for (const [joinCode, room] of activeRooms()) {
      if (room.track && room.startedAt !== null) {
        io.to(joinCode).emit("session:resync", { trackId: room.track.id, positionMs: positionMs(room.startedAt, now) });
      }
    }
  }, RESYNC_INTERVAL_MS);
  resync.unref();

  return io;
}
