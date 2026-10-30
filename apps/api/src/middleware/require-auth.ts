import type { RequestHandler } from "express";
import { ApiError } from "../utils/errors.js";
import { SESSION_COOKIE_NAME, findSession } from "../services/session.service.js";
import { isProd } from "../config/env.js";

/**
 * Guard every protected endpoint: resolves the session cookie against the
 * store (with expiry enforced at query time — TTL sweeps are eventually
 * consistent, reads are not), attaches the admin id to the request, and
 * responds 401 otherwise.
 */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token) {
    next(ApiError.unauthorized());
    return;
  }

  const session = await findSession(token);
  if (!session) {
    // Stale cookie hygiene: remove it so lingering UI tokens self-heal.
    res.clearCookie(SESSION_COOKIE_NAME, { path: "/", httpOnly: true, sameSite: "strict", secure: isProd });
    next(ApiError.unauthorized());
    return;
  }

  res.locals.adminId = session.adminId;
  next();
};
