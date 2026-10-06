import { createServer } from "node:http";
import { createApp, sessionMiddleware } from "./app.js";
import { prisma } from "./db/client.js";
import { env } from "./env.js";
import { redis } from "./lib/redis.js";
import { captureError, flushSentry, initSentry } from "./lib/sentry.js";
import { attachSessionGateway } from "./sockets/sessionGateway.js";

initSentry();

const httpServer = createServer(createApp());
const io = attachSessionGateway(httpServer, sessionMiddleware);

httpServer.listen(env.PORT, () => {
  console.log(`api listening on http://localhost:${env.PORT}`);
});

// Render stops the old instance with SIGTERM on every deploy: finish in-flight requests, then exit.
let shuttingDown = false;
async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  try {
    await io.close();
    await Promise.allSettled([prisma.$disconnect(), redis.quit(), flushSentry()]);
  } finally {
    process.exit(exitCode);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection", reason);
  captureError(reason);
});
process.on("uncaughtException", (err) => {
  console.error("uncaughtException", err);
  captureError(err);
  void shutdown("uncaughtException", 1);
});
