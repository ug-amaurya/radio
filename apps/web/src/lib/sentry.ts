// Sentry is loaded on demand and only when VITE_SENTRY_DSN is set, so it costs nothing otherwise.
type Sentry = typeof import("@sentry/react");

let sentry: Promise<Sentry | null> | null = null;

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  sentry = import("@sentry/react").then((s) => {
    s.init({ dsn, environment: import.meta.env.MODE, tracesSampleRate: 0 });
    return s;
  });
  window.addEventListener("unhandledrejection", (e) => captureError(e.reason));
}

export function captureError(err: unknown): void {
  void sentry?.then((s) => s?.captureException(err)).catch(() => undefined);
}
