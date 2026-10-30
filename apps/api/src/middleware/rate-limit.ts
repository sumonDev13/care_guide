import { rateLimit, type Options } from "express-rate-limit";
import type { RequestHandler } from "express";
import { env } from "../config/env.js";

function toRateLimitOptions(windowMin: number, max: number, message: unknown): Partial<Options> {
  return {
    windowMs: windowMin * 60 * 1000,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message,
  };
}

/**
 * Conservative global limiter: a blunt defense against abusive clients and
 * runaway polling, keyed by IP. The login-specific, aggressive limiter lives
 * with the auth feature — this one must never become a bottleneck for the
 * dashboard's legitimate traffic.
 *
 * NOTE: trust proxy stays at Express's default (disabled) — the app is not
 * behind a reverse proxy today. If that changes, `trust proxy` must be
 * revisited together with both limiters so the real client IP — not the
 * proxy's — is rate-limit keyed.
 *
 * A fresh instance is created per app (see createApp) so test instances do
 * not share an in-memory store.
 */
export function makeRateLimiter(): RequestHandler {
  return rateLimit({
    ...toRateLimitOptions(env.rateLimitWindowMinutes, env.rateLimitMaxRequests, {
      success: false,
      error: { code: "RATE_LIMITED", message: "Too many requests — slow down and retry later." },
    }),
    skip: (req) => req.path.startsWith("/api/health"),
  });
}

/**
 * Aggressive limiter for the sensitive route: login. Brute-force resistance
 * independent of password-politics (fail-2geysering would be slower anyway).
 * Keyed by IP; a lockout-by-email strategy is deliberately deferred until
 * multi-admin convenience makes it worth the DoS-on-a-victim trade-off.
 */
export function makeLoginLimiter(): RequestHandler {
  return rateLimit({
    ...toRateLimitOptions(env.authLoginWindowMinutes, env.authLoginMaxAttempts, {
      success: false,
      error: { code: "RATE_LIMITED", message: "Too many login attempts — wait before retrying." },
    }),
  });
}
