import { rateLimit } from "express-rate-limit";
import type { RequestHandler } from "express";
import { env } from "../config/env.js";

/**
 * Conservative global limiter: a blunt defense against abusive clients and
 * runaway polling, per IP. The login-specific, aggressive limiter lives with
 * the auth feature (Step 5) — this one must never become a bottle-neck for the
 * dashboard's legitimate traffic.
 *
 * NOTE: trust proxy stays at Express's default (disabled) — the app is not
 * behind a reverse proxy in the current deployment. If that changes, the
 * `trust proxy` setting must be revisited together with the limiter so the
 * real client IP — not the proxy's — is rate-limit keyed.
 *
 * A fresh instance is created per app (see createApp) so test apps do not
 * share a memory store.
 */
export function makeRateLimiter(): RequestHandler {
  return rateLimit({
    windowMs: env.rateLimitWindowMinutes * 60 * 1000,
    limit: env.rateLimitMaxRequests,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: (req) => req.path.startsWith("/api/health"),
    message: {
      success: false,
      error: { code: "RATE_LIMITED", message: "Too many requests — retry later." },
    },
  });
}
