import cors from "cors";
import { env } from "../config/env.js";

/**
 * Allowlist CORS with credentials — the browser sends the HttpOnly session
 * cookie to this API, so credentials must flow and only the configured
 * frontend origins may see authorization-relevant CORS response headers.
 *
 * Non-browser clients (curl, monitoring, tests) send no Origin header and are
 * not subject to CORS at all.
 */
export const corsMiddleware = cors({
  origin(origin, callback) {
    if (origin === undefined || env.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    // Deny without an error: the browser blocks the response for the client,
    // and the API still answers valid non-CORS requests.
    callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Requested-With"],
  maxAge: 600,
});
