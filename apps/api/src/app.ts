import express, { type Express } from "express";
import { env } from "./config/env.js";
import { securityHeaders, cookieMiddleware } from "./middleware/security.js";
import { corsMiddleware } from "./middleware/cors.js";
import { requestLogger, requestIdResponseHeader } from "./middleware/request-logger.js";
import { makeRateLimiter } from "./middleware/rate-limit.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/express-error-handler.js";
import { apiRouter } from "./routes/index.js";

/**
 * The Express application (middleware chain + routes). Deliberately separated
 * from the listener in server.ts so tests can exercise the full pipeline in
 * process, without opening ports.
 *
 * Middleware order is load-bearing — request parsing and correlation must be
 * in place before anything that can read cookies or fail on a request body.
 */
export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");

  app.use(securityHeaders);
  app.use(cookieMiddleware);
  app.use(corsMiddleware);
  app.use(express.json({ limit: "10kb" }));
  app.use(requestLogger);
  app.use(requestIdResponseHeader);
  app.use(makeRateLimiter());

  app.use("/api", apiRouter);

  // Test-only escape hatch so the central error handler's unexpected-error
  // path is verifiable without mocking the framework internals.
  if (env.nodeEnv === "test") {
    app.get("/api/test/boom", () => {
      throw new Error("simulated unexpected failure");
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
