import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env.js";

const TTL_MS = 60_000;

const sign = (payload: string) => createHmac("sha256", `${env.SESSION_SECRET}:socket`).update(payload).digest("base64url");

/**
 * Short-lived token proving "this user is logged in", for the websocket handshake. In production the
 * socket connects straight to the API host, where the site's session cookie isn't sent (different domain).
 */
export function createSocketToken(userId: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: now + TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the user id if the token is genuine and unexpired, otherwise null. */
export function verifySocketToken(token: unknown, now = Date.now()): string | null {
  if (typeof token !== "string") return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { uid?: unknown; exp?: unknown };
    return typeof uid === "string" && typeof exp === "number" && exp > now ? uid : null;
  } catch {
    return null;
  }
}
