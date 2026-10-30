import helmet from "helmet";
import cookieParser from "cookie-parser";

/**
 * Sensible security header defaults (no configuration is needed yet — CSP can
 * be tightened per-frontend once it exists).
 */
export const securityHeaders = helmet();

/**
 * Parses Cookie headers into req.cookies. The auth step (Step 5) reads the
 * session from this — mounted now exactly as it will be consumed then so the
 * middleware order is real, not aspirational.
 */
export const cookieMiddleware = cookieParser();
