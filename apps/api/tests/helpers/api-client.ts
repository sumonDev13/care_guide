import supertest from "supertest";
import { createApp } from "../../src/app.js";
import type { CreateAppOptions } from "../../src/routes/index.js";

/**
 * In-process HTTP client over a fresh app instance per call — isolation
 * between cases without ports, sockets, or shared middleware state.
 */
export function makeApiClient(options: CreateAppOptions = {}): { client: ReturnType<typeof supertest> } {
  return { client: supertest(createApp(options)) };
}

/** All API calls in this suite satisfy the CSRF custom-header contract. */
export const withCsrfHeader = { "X-Requested-With": "XMLHttpRequest" };

/** Pulls a `dt_session=…; …` cookie pair out of a Set-Cookie response header. */
export function extractSessionCookie(res: { headers: Record<string, unknown> }): string {
  const setCookie = res.headers["set-cookie"];
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (typeof raw !== "string" || !raw.startsWith("dt_session=")) {
    throw new Error("Expected a session Set-Cookie header");
  }
  return raw.split(";")[0]?.trim() ?? "";
}
