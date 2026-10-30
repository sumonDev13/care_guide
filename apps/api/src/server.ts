import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./config/mongodb.js";
import { logger } from "./middleware/request-logger.js";

/**
 * Hard-fail fast: a database-less API instance would silently serve nothing
 * useful — better to crash-loop visibly than to look healthy while broken.
 */
try {
  await connectDatabase();
} catch (err) {
  logger.error({ err }, "Failed to connect to MongoDB — refusing to start");
  process.exit(1);
}

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info(
    `doctor-tracker API listening on http://localhost:${env.port} (${env.nodeEnv})`,
  );
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    logger.error(`Port ${env.port} is already in use — free it or set API_PORT.`);
  } else {
    logger.error({ err }, "Server error");
  }
  process.exit(1);
});

let isShuttingDown = false;
function shutdown(signal: string): void {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`${signal} received — closing server gracefully`);
  server.close(() => {
    void disconnectDatabase()
      .catch(() => undefined)
      .then(() => process.exit(0));
  });
  // In-flight requests get a grace window; then we leave regardless.
  setTimeout(() => process.exit(0), 3_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — exiting");
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection — exiting");
  process.exit(1);
});
