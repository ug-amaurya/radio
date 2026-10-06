import type { NextFunction, Request, Response } from "express";
import { isGuestUser } from "../lib/guest.js";

/** Blocks guest sessions from features that need a real Audius account (favorites, playlists). */
export function requireAudiusAccount(req: Request, res: Response, next: NextFunction): void {
  if (req.user && isGuestUser(req.user)) {
    res.status(403).json({ error: "Log in with Audius to use this feature" });
    return;
  }
  next();
}
