import { Router } from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { sendSuccess } from "../utils/http-response.js";

const packageJson = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "../../package.json"), "utf8"),
) as { version: string };

/**
 * Liveness/readiness probe. Kept cheap and dependency-free: no database touch
 * (the DB connection adds its own state endpoint once integrated).
 */
export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  sendSuccess(res, {
    status: "ok",
    service: "doctor-tracker-api",
    version: packageJson.version,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});
