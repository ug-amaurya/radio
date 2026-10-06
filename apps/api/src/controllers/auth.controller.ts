import type { Request, Response } from "express";
import type { AuthCallbackRequest, SessionUserResponse } from "@audius-radio/shared-types";
import type { User } from "@prisma/client";
import { prisma } from "../db/client.js";
import { verifyAudiusToken } from "../services/audiusClient.js";
import { createSocketToken } from "../services/socketToken.js";
import { createGuestIdentity, isGuestUser } from "../lib/guest.js";

function toPublicUser(user: User): SessionUserResponse {
  return {
    user: {
      id: user.id,
      audiusUserId: user.audiusUserId,
      handle: user.handle,
      displayName: user.displayName,
      isGuest: isGuestUser(user),
      createdAt: user.createdAt.toISOString(),
    },
  };
}

export async function callback(req: Request, res: Response<SessionUserResponse | { error: string }>) {
  const { token } = req.body as Partial<AuthCallbackRequest>;
  if (!token) {
    res.status(400).json({ error: "token is required" });
    return;
  }

  let profile;
  try {
    profile = await verifyAudiusToken(token);
  } catch {
    res.status(401).json({ error: "Could not verify Audius login" });
    return;
  }

  const user = await prisma.user.upsert({
    where: { audiusUserId: profile.userId },
    create: { audiusUserId: profile.userId, handle: profile.handle, displayName: profile.name },
    update: { handle: profile.handle, displayName: profile.name },
  });

  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
  req.session.userId = user.id;

  res.json(toPublicUser(user));
}

/** Fallback for users who can't reach Audius login (e.g. audius.co is blocked in their region). */
export async function guest(req: Request, res: Response<SessionUserResponse>) {
  const user = await prisma.user.create({ data: createGuestIdentity() });

  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
  req.session.userId = user.id;

  res.status(201).json(toPublicUser(user));
}

export function me(req: Request, res: Response<SessionUserResponse>): void {
  res.json(toPublicUser(req.user!));
}

export function logout(req: Request, res: Response): void {
  req.session.destroy(() => {
    res.clearCookie("audius_radio_sid");
    res.status(204).end();
  });
}

/** A 60-second token the browser uses to authenticate its websocket connection. */
export function socketToken(req: Request, res: Response): void {
  res.json({ token: createSocketToken(req.user!.id) });
}
