import type { NextConfig } from "next";

/**
 * Same-origin API wiring (decision #18). The browser never calls the API
 * across origins: every `/api/*` request is proxied by the Next server to the
 * API process, which means
 *   - the `dt_session` cookie is first-party, so `SameSite=Strict` applies
 *     exactly as the API issued it (no third-party cookie behavior),
 *   - the browser's `Origin` header reaches the API unchanged, passing the
 *     CSRF allowlist (dev default `http://localhost:3000`),
 *   - no CORS configuration exists to maintain.
 *
 * The proxy target comes from the web process environment (`WEB_API_ORIGIN`),
 * defaulting to the local dev API. Next reads `.env` only from its own root —
 * the single root `.env` (decision #11) serves the API process; production
 * deploys pass `WEB_API_ORIGIN` directly to the web process.
 */
const apiOrigin = process.env.WEB_API_ORIGIN ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
