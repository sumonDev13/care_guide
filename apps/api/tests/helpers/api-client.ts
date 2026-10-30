import supertest from "supertest";
import { createApp } from "../../src/app.js";

/**
 * In-process HTTP client over a fresh app instance per call — isolation
 * between cases without ports, sockets, or shared middleware state.
 */
export function makeApiClient(): { client: ReturnType<typeof supertest> } {
  return { client: supertest(createApp()) };
}
