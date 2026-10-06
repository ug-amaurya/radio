import * as Sentry from "@sentry/node";
import { env } from "../env.js";

/** Starts Sentry when SENTRY_DSN is set; everything below is a no-op otherwise. */
export function initSentry(): void {
  if (!env.SENTRY_DSN) return;
  Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV, tracesSampleRate: 0 });
}

export function captureError(err: unknown): void {
  if (env.SENTRY_DSN) Sentry.captureException(err);
}

export function flushSentry(timeoutMs = 2000): Promise<boolean> {
  return env.SENTRY_DSN ? Sentry.flush(timeoutMs) : Promise.resolve(true);
}
