import { describe, expect, it } from "vitest";
import { makeApiClient } from "./helpers/api-client.js";

describe("GET /api/health", () => {
  it("responds 200 with the standard success envelope", async () => {
    const res = await makeApiClient().client.get("/api/health");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({
      success: true,
      data: expect.objectContaining({
        status: "degraded", // no database in pure HTTP-layer tests
        service: "doctor-tracker-api",
        version: expect.any(String),
        uptimeSeconds: expect.any(Number),
        database: { state: "disconnected" },
        timestamp: expect.any(String),
      }),
    });
  });

  it("exposes a correlation id response header", async () => {
    const res = await makeApiClient().client.get("/api/health");

    expect(res.headers["x-request-id"]).toBeDefined();
  });
});
