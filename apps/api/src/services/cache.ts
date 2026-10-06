import { redis } from "../lib/redis.js";

/** Returns the cached JSON value for `key`, or computes, stores (with TTL) and returns it. */
export async function cached<T>(key: string, ttlSec: number, load: () => Promise<T>): Promise<T> {
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit) as T;
  const value = await load();
  await redis.set(key, JSON.stringify(value), "EX", ttlSec);
  return value;
}
