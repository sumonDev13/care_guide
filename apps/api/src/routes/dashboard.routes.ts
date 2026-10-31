import { Router } from "express";
import { requireAuth } from "../middleware/require-auth.js";
import { getDashboardStatsHandler } from "../controllers/dashboard.controller.js";

/**
 * Dashboard surface — admin-console-only, so the whole router sits behind
 * the session guard. Read-only analytics; no mutating endpoints here.
 */
export function makeDashboardRouter(): Router {
  const dashboardRouter = Router();

  dashboardRouter.use(requireAuth);

  dashboardRouter.get("/", getDashboardStatsHandler);

  return dashboardRouter;
}