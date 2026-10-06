import { randomInt } from "node:crypto";
import type { Track } from "@audius-radio/shared-types";
import { prisma } from "../db/client.js";
import { positionMs } from "./sessionClock.js";

// No 0/O/1/I so codes are easy to read out loud.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

/** Live room state. Track metadata lives in memory; the DB keeps ids + the start time. */
export interface Room {
  hostUserId: string;
  track: Track | null;
  upNext: Track[];
  startedAt: number | null;
}

const rooms = new Map<string, Room>();

export const generateJoinCode = (): string =>
  Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

export async function createSession(hostUserId: string, stationId: string) {
  // Retry on the (very unlikely) unique-code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const joinCode = generateJoinCode();
    if (await prisma.sharedSession.findUnique({ where: { joinCode } })) continue;
    const session = await prisma.sharedSession.create({ data: { hostUserId, stationId, joinCode } });
    rooms.set(joinCode, { hostUserId, track: null, upNext: [], startedAt: null });
    return session;
  }
  throw new Error("Could not generate a unique join code");
}

/** Returns the live room, rebuilding an empty one from the DB after a server restart. */
export async function getRoom(joinCode: string): Promise<Room | null> {
  const existing = rooms.get(joinCode);
  if (existing) return existing;
  const session = await prisma.sharedSession.findUnique({ where: { joinCode } });
  if (!session?.active) return null;
  const room: Room = { hostUserId: session.hostUserId, track: null, upNext: [], startedAt: null };
  rooms.set(joinCode, room);
  return room;
}

export async function setTrack(joinCode: string, track: Track, upNext: Track[], startedAt = Date.now()): Promise<Room | null> {
  const room = await getRoom(joinCode);
  if (!room) return null;
  room.track = track;
  room.upNext = upNext;
  room.startedAt = startedAt;
  await prisma.sharedSession.update({
    where: { joinCode },
    data: { currentTrackId: track.id, trackStartedAt: new Date(startedAt) },
  });
  return room;
}

export async function endSession(joinCode: string): Promise<void> {
  rooms.delete(joinCode);
  await prisma.sharedSession.updateMany({ where: { joinCode }, data: { active: false } });
}

export function snapshot(room: Room, now = Date.now()) {
  return {
    track: room.track,
    upNext: room.upNext,
    positionMs: room.startedAt === null ? 0 : positionMs(room.startedAt, now),
  };
}

export function activeRooms(): Array<[string, Room]> {
  return [...rooms.entries()];
}
