import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// .env lives at the monorepo root (see .env.example), not in apps/api/,
// so it needs an explicit path rather than dotenv's cwd-relative default.
dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(4000),
  AUDIUS_API_KEY: z.string().min(1, "AUDIUS_API_KEY is required"),
  AUDIUS_BEARER_TOKEN: z.string().min(1, "AUDIUS_BEARER_TOKEN is required"),
  AUDIUS_REDIRECT_URI: z.string().url(),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 characters"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  FRONTEND_ORIGIN: z.string().url(),
  /** Optional: enables Sentry error reporting. */
  SENTRY_DSN: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined),
  COOKIE_SECURE: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
});

export const env = envSchema.parse(process.env);
