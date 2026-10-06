import { redis } from "../lib/redis.js";

/** Audius free plan: 500,000 requests per month. */
export const MONTHLY_LIMIT = 500_000;

export type UsageLevel = "ok" | "warn" | "critical" | "over";

export function usageLevel(count: number, limit = MONTHLY_LIMIT): UsageLevel {
  if (count > limit) return "over";
  if (count >= limit * 0.95) return "critical";
  if (count >= limit * 0.8) return "warn";
  return "ok";
}

export const usageKey = (now = new Date()) => `audius:usage:${now.toISOString().slice(0, 7)}`;

const EXPIRE_SEC = 60 * 60 * 24 * 40;

/** Counts one Audius API call for this month and logs once when usage crosses a threshold. */
export async function recordAudiusCall(): Promise<void> {
  try {
    const key = usageKey();
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, EXPIRE_SEC);
    const level = usageLevel(count);
    if (level !== "ok" && level !== usageLevel(count - 1)) {
      console.warn(`[audius usage] ${level}: ${count}/${MONTHLY_LIMIT} requests used this month`);
    }
  } catch {
    // Metering must never break a user request.
  }
}

export async function getMonthlyUsage(): Promise<{ count: number; limit: number; level: UsageLevel }> {
  const count = Number((await redis.get(usageKey())) ?? 0);
  return { count, limit: MONTHLY_LIMIT, level: usageLevel(count) };
}
