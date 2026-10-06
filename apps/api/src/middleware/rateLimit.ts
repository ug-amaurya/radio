import type { NextFunction, Request, Response } from "express";
import { redis } from "../lib/redis.js";

/** Fixed-window per-IP limiter backed by Redis. */
export function rateLimit(opts: { name: string; max: number; windowSec: number }) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = `rl:${opts.name}:${req.ip}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, opts.windowSec);
      if (count > opts.max) {
        res.status(429).json({ error: "Too many requests, try again later" });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
