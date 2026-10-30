import { Router } from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { sendSuccess } from "../utils/http-response.js";
import { getMongoState } from "../config/mongodb.js";

const packageJson = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "../../package.json"), "utf8"),
) as { version: string };

/**
 * Liveness probe: always cheap (no database IO — state is read from the
 * existing connection object), always HTTP 200 so load balancers don't
 * restart the instance over a transient DB hiccup. The truthful per-dependency
 * state lives in the payload: `database.state`, with top-level `status`
 * switching to "degraded" so alerts can key off the body.
 */
export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  const mongoState = getMongoState();
  sendSuccess(res, {
    status: mongoState === "connected" ? "ok" : "degraded",
    service: "doctor-tracker-api",
    version: packageJson.version,
    uptimeSeconds: Math.round(process.uptime()),
    database: { state: mongoState },
    timestamp: new Date().toISOString(),
  });
});
