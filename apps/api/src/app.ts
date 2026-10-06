import cors from "cors";
import express from "express";
import session from "express-session";
import RedisStore from "connect-redis";
import helmet from "helmet";
import { env } from "./env.js";
import { redis } from "./lib/redis.js";
import { authRouter } from "./routes/auth.routes.js";
import { catalogRouter, libraryRouter } from "./routes/catalog.routes.js";
import { feedbackRouter } from "./routes/feedback.routes.js";
import { historyRouter, stationsRouter } from "./routes/stations.routes.js";
import { sessionsRouter } from "./routes/sessions.routes.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

/** Shared with the Socket.IO gateway so sockets authenticate with the same session cookie. */
export const sessionMiddleware = session({
  store: new RedisStore({ client: redis, prefix: "sess:" }),
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: "audius_radio_sid",
  cookie: {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  },
});

export function createApp() {
  const app = express();
  // Behind Render/Vercel the client IP arrives in X-Forwarded-For; with the wrong hop count every user shares one rate-limit bucket.
  if (env.NODE_ENV === "production") app.set("trust proxy", env.TRUST_PROXY_HOPS);

  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(sessionMiddleware);

  app.get("/health", (_req, res) => res.json({ ok: true }));
  // Generous (10 req/s per IP) but stops a runaway client from burning the monthly Audius budget.
  app.use("/api", rateLimit({ name: "api", max: 600, windowSec: 60 }));
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/catalog", requireAuth, catalogRouter);
  app.use("/api/v1/library", libraryRouter);
  app.use("/api/v1/stations", stationsRouter);
  app.use("/api/v1/history", historyRouter);
  app.use("/api/v1/feedback", feedbackRouter);
  app.use("/api/v1/sessions", sessionsRouter);

  app.use("/api", notFound);
  app.use(errorHandler);

  return app;
}
