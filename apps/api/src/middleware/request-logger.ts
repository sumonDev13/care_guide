import { pino } from "pino";
import { pinoHttp } from "pino-http";
import type { RequestHandler } from "express";
import { env } from "../config/env.js";

/**
 * Root pino logger. Test runs default to `silent` via vitest test env.
 */
export const logger = pino({ level: env.logLevel });

/**
 * HTTP request logging that is useful but never leaky: bodies are not
 * serialized, and credential/token-family headers are redacted before logging.
 */
export const requestLogger = pinoHttp({
  logger,
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "req.headers.set-cookie"],
    censor: "[redacted]",
  },
  autoLogging: {
    // Health probes are polled continuously by monitoring; logging each one
    // is pure noise. Their success is observable via the limiter-exempt route.
    ignore: (req) => (req.url ?? "").startsWith("/api/health"),
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
});

/**
 * Exposes the pino-http request id as a response header so clients can quote a
 * correlation id in bug reports.
 */
export const requestIdResponseHeader: RequestHandler = (req, res, next) => {
  if (typeof req.id === "string" || typeof req.id === "number") {
    res.setHeader("x-request-id", req.id);
  }
  next();
};
