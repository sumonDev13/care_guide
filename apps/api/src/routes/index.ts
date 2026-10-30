import { Router } from "express";
import { healthRouter } from "./health.routes.js";

/**
 * Mounted at /api. Routers are added per feature as steps land:
 *   /api/auth        (Step 5)
 *   /api/doctors     (Step 6)
 *   /api/patients    (Step 7)
 *   /api/dashboard   (Step 11)
 */
export const apiRouter = Router();

apiRouter.use("/", healthRouter);
