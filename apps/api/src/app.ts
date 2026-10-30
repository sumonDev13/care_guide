import express, { type Express } from "express";
import { securityHeaders, cookieMiddleware } from "./middleware/security.js";
import { corsMiddleware } from "./middleware/cors.js";
import { requestLogger, requestIdResponseHeader } from "./middleware/request-logger.js";
import { csrfGuard } from "./middleware/csrf-guard.js";
import { makeRateLimiter } from "./middleware/rate-limit.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/express-error-handler.js";
import { makeApiRouter, type CreateAppOptions } from "./routes/index.js";

/**
 * The Express application (middleware chain + routes). Deliberately separated
 * from the listener in server.ts so the full pipeline can be built once and
 * mounted without opening ports.
 *
 * Middleware order is load-bearing — cookies must be parsed before CSRF or
 * auth read them, and both must exist before any route logic that depends
 * on them.
 */
export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();

  app.disable("x-powered-by");

  app.use(securityHeaders);
  app.use(cookieMiddleware);
  app.use(corsMiddleware);
  app.use(express.json({ limit: "10kb" }));
  app.use(requestLogger);
  app.use(requestIdResponseHeader);
  app.use(csrfGuard);
  app.use(makeRateLimiter());

  app.use("/api", makeApiRouter(options));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
