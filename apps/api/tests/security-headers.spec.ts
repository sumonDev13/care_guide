import { describe, expect, it } from "vitest";
import { makeApiClient } from "./helpers/api-client.js";

describe("security headers", () => {
  it("applies helmet defaults", async () => {
    const res = await makeApiClient().client.get("/api/health");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("CORS", () => {
  it("allows configured origins with credentials", async () => {
    const res = await makeApiClient().client
      .get("/api/health")
      .set("Origin", "http://localhost:3000");

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("withholds CORS headers for unlisted origins", async () => {
    const res = await makeApiClient().client
      .get("/api/health")
      .set("Origin", "http://definitely-not-allowed.example");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    expect(res.status).toBe(200); // denial is browser-side, not a late 4xx
  });
});

describe("rate limiting", () => {
  it("exposes standard rate-limit headers and exempts /api/health", async () => {
    const healthRes = await makeApiClient().client.get("/api/health");
    expect(healthRes.headers["ratelimit"]).toBeUndefined(); // skipped

    // A different path passes through the limiter and reports its budget.
    // express-rate-limit v8 with draft-7 headers sends the combined header.
    const limitedRes = await makeApiClient().client.get("/api/not-a-route");
    expect(limitedRes.headers["ratelimit"]).toMatch(/limit=\d+/);
    expect(limitedRes.headers["ratelimit-policy"]).toBeDefined();
  });
});
