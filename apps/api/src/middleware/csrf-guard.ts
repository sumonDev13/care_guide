import type { RequestHandler } from "express";
import { ApiError } from "../utils/errors.js";
import { env } from "../config/env.js";

/**
 * CSRF defense in depth for state-changing requests, on top of the SameSite
 * cookie configuration:
 *
 *  1. Cookie is SameSite=strict — cross-site navigations can't send it.
 *  2. Any `Origin` header present MUST be on the CORS allowlist.
 *  3. Every mutation must carry `X-Requested-With: XMLHttpRequest` —
 *     un-spinnable-by-attacker custom header (same-originpages only).
 *
 * Non-mutating methods pass through. Browser clients always send Origin;
 * plain tools (curl, health checks, tests) may omit it and are unaffected.
 */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const REQUIRED_REQUESTED_WITH = "XMLHttpRequest";

export const csrfGuard: RequestHandler = (req, _res, next) => {
  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }

  const origin = req.headers.origin;
  if (origin !== undefined && !env.corsOrigins.includes(origin)) {
    next(ApiError.forbidden("Request origin is not allowed."));
    return;
  }

  if (req.headers["x-requested-with"] !== REQUIRED_REQUESTED_WITH) {
    next(
      ApiError.forbidden(
        "CSRF check failed — a mutating request must include X-Requested-With: XMLHttpRequest.",
      ),
    );
    return;
  }

  next();
};
