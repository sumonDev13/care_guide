import { Router } from "express";
import type { RequestHandler } from "express";
import { login, logout, me } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/require-auth.js";
import { makeLoginLimiter } from "../middleware/rate-limit.js";

/**
 * Authentication surface. The login limiter is created per router build so a
 * test-injected limiter (isolated 429 verification) never persists to the
 * production process/service lifecycle.
 */
export function makeAuthRouter(loginLimiter?: RequestHandler): Router {
  const authRouter = Router();

  authRouter.post("/login", loginLimiter ?? makeLoginLimiter(), login);
  authRouter.post("/logout", requireAuth, logout);
  authRouter.get("/me", requireAuth, me);

  return authRouter;
}
