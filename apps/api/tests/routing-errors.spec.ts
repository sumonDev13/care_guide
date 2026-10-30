import { describe, expect, it } from "vitest";
import { makeApiClient } from "./helpers/api-client.js";

describe("unmatched routes", () => {
  it("returns a structured 404 in the standard error envelope", async () => {
    const res = await makeApiClient().client.get("/api/this-route-does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: "ROUTE_NOT_FOUND",
        message: expect.stringContaining("/api/this-route-does-not-exist"),
      },
    });
  });
});

describe("malformed request bodies", () => {
  it("rejects invalid JSON with 400 and a client-safe message", async () => {
    const res = await makeApiClient().client
      .post("/api/health")
      .set("Content-Type", "application/json")
      .send('{"broken json');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: "INVALID_JSON_BODY",
        message: "The request body is not valid JSON.",
      },
    });
    expect(res.text).not.toMatch(/SyntaxError/i);
  });
});

describe("unexpected server errors (test-only /api/test/boom route)", () => {
  it("returns a generic 500 without leaking internals", async () => {
    const res = await makeApiClient().client.get("/api/test/boom");

    expect(res.status).toBe(500);
    // Exact intended body: proves the thrown internals (error name, message,
    // stack) were replaced by the generic public error shape.
    expect(res.text).toBe(
      '{"success":false,"error":{"code":"INTERNAL_SERVER_ERROR","message":"An unexpected error occurred. Please try again."}}',
    );
    expect(res.text).not.toMatch(/simulated/i);
    expect(res.headers["x-request-id"]).toBeDefined();
  });
});
