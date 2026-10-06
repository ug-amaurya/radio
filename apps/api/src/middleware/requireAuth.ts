import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db/client.js";

/** Requires an active session and attaches the session's user to the request. */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      req.session.userId = undefined;
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
