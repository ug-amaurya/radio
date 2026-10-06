import { AxiosError } from "axios";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { env } from "../env.js";
import { captureError } from "../lib/sentry.js";

/** Throw from a handler to send a specific status and a message that is safe to show users. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface ErrorResponse {
  status: number;
  message: string;
  /** Whether this is a server-side fault worth reporting (5xx). */
  report: boolean;
}

/** Turns any thrown value into a status and a user-safe message. Internals are never leaked. */
export function toErrorResponse(err: unknown): ErrorResponse {
  if (err instanceof HttpError) return { status: err.status, message: err.message, report: err.status >= 500 };
  if (err instanceof ZodError) {
    return { status: 400, message: err.issues[0]?.message ?? "Invalid request", report: false };
  }
  if (err instanceof AxiosError) {
    // Audius (the only upstream) failing is not our bug, but the user needs to know it's temporary.
    if (err.response?.status === 429) {
      return { status: 503, message: "Audius is busy right now. Please try again in a moment.", report: true };
    }
    if (err.response?.status === 404) {
      return { status: 404, message: "That track or playlist wasn't found on Audius.", report: false };
    }
    return { status: 502, message: "Couldn't reach Audius. Please try again.", report: true };
  }
  return { status: 500, message: "Something went wrong on our side.", report: true };
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not found" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const { status, message, report } = toErrorResponse(err);
  if (report) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    captureError(err);
  }
  if (res.headersSent) return;
  // In development, include the real message to make debugging easier.
  const detail = env.NODE_ENV !== "production" && status >= 500 && err instanceof Error ? err.message : undefined;
  res.status(status).json({ error: message, ...(detail && { detail }) });
}
