import { Router } from "express";
import type { RequestHandler } from "express";
import { healthRouter } from "./health.routes.js";
import { makeAuthRouter } from "./auth.routes.js";
import { makeDoctorsRouter } from "./doctors.routes.js";
import { makePatientsRouter } from "./patients.routes.js";

/**
 * Options plumbed only for test isolation of shared-process behavior
 * (currently the login limiter); production always uses env defaults.
 * (Lives here so app.ts can type-import it without import cycles.)
 */
export type CreateAppOptions = {
  loginLimiter?: RequestHandler;
};

/**
 * Mounted at /api. Routers are added per feature as steps land:
 *   /api/auth        (Step 5)
 *   /api/doctors     (Step 6, protected)
 *   /api/patients    (Step 7, protected)
 *   /api/dashboard   (Step 11)
 */
export function makeApiRouter(options: CreateAppOptions = {}): Router {
  const apiRouter = Router();

  apiRouter.use("/", healthRouter);
  apiRouter.use("/auth", makeAuthRouter(options.loginLimiter));
  apiRouter.use("/doctors", makeDoctorsRouter());
  apiRouter.use("/patients", makePatientsRouter());

  return apiRouter;
}
