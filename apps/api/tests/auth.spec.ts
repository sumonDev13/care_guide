import { verify } from "@node-rs/argon2";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import type { RequestHandler } from "express";
import { connectDatabase, disconnectDatabase } from "../src/config/mongodb.js";
import { startTestDb, stopTestDb } from "./helpers/mongodb.js";
import { AdminModel } from "../src/models/index.js";
import { SessionModel } from "../src/models/session.model.js";
import { hashPassword } from "../src/services/auth.service.js";
import { hashSessionToken } from "../src/services/session.service.js";
import { makeApiClient, withCsrfHeader, extractSessionCookie } from "./helpers/api-client.js";

/**
 * Authentication + authorization integration suite over the real middleware
 * pipeline: login/uniform-failure, session cookie semantics, protected-route
 * gating, CSRF triple-defense, logout revocation, expiry semantics, login
 * rate limiting, and session-store indexes. Everything runs hermetically.
 */
const UNIQUE_EMAIL = () => `admin-${randomUUID()}@mail.example.com`;
const STRONG_PASSWORD = "correct horse battery stapler";

const adminFixture = {
  name: "Ops Admin",
  email: UNIQUE_EMAIL(),
  password: STRONG_PASSWORD,
};

beforeAll(async () => {
  const { uri, dbName } = await startTestDb();
  await connectDatabase({ uri, dbName });
  await AdminModel.create({
    name: adminFixture.name,
    email: adminFixture.email,
    passwordHash: await hashPassword(adminFixture.password),
  });
});

afterAll(async () => {
  await disconnectDatabase();
  await stopTestDb();
});

describe("password hashing", () => {
  it("emits argon2id PHC strings with the OWASP-parameter set", async () => {
    const phc = await hashPassword("some-plain-password-42");

    // The library's default algorithm is argon2id — this pins it so a future
    // upgrade of @node-rs/argon2 cannot silently change the scheme.
    expect(phc.startsWith("$argon2id$")).toBe(true);
    expect(phc).toContain("m=19456");
    expect(phc).toContain("t=2");
    expect(phc).toContain("p=1");

    // Round-trip semantics of the exact verify() call used at login time.
    expect(await verify(phc, "some-plain-password-42")).toBe(true);
    expect(await verify(phc, "wrong-password")).toBe(false);
  });
});

describe("POST /api/auth/login", () => {
  it("logs a valid admin in with an HttpOnly SameSite cookie", async () => {
    const res = await makeApiClient().client
      .post("/api/auth/login")
      .set(withCsrfHeader)
      .send({ email: adminFixture.email, password: adminFixture.password });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: { admin: { name: adminFixture.name, email: adminFixture.email } },
    });

    const cookie = extractSessionCookie(res);
    expect(cookie).toMatch(/^dt_session=[A-Za-z0-9]{64}$/);

    const setCookie = String(res.headers["set-cookie"]?.[0]);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).toContain("Path=/");

    // The plaintext password or anything hash-like must not leave the process.
    expect(res.text).not.toContain("passwordHash");
  });

  it("normalizes email case on login", async () => {
    const res = await makeApiClient().client
      .post("/api/auth/login")
      .set(withCsrfHeader)
      .send({ email: adminFixture.email.toUpperCase(), password: adminFixture.password });

    expect(res.status).toBe(200);
  });

  it("is uniformly 401 for wrong password AND unknown email", async () => {
    const wrongPassword = await makeApiClient().client
      .post("/api/auth/login")
      .set(withCsrfHeader)
      .send({ email: adminFixture.email, password: "definitely-not-the-password" });

    const unknownEmail = await makeApiClient().client
      .post("/api/auth/login")
      .set(withCsrfHeader)
      .send({ email: `ghost-${randomUUID()}@mail.example.com`, password: "whatever-password-123" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
    expect(wrongPassword.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects malformed login bodies with 422 validation envelope", async () => {
    const missingPassword = await makeApiClient().client
      .post("/api/auth/login")
      .set(withCsrfHeader)
      .send({ email: adminFixture.email });

    const badEmail = await makeApiClient().client
      .post("/api/auth/login")
      .set(withCsrfHeader)
      .send({ email: "not-an-email", password: "whatever-password-123" });

    expect(missingPassword.status).toBe(422);
    expect(badEmail.status).toBe(422);
    expect(missingPassword.body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(missingPassword.body.error.details)).toBe(true);
  });
});

describe("CSRF protection", () => {
  it("rejects mutations without the X-Requested-With header", async () => {
    const res = await makeApiClient().client
      .post("/api/auth/login")
      .send({ email: adminFixture.email, password: adminFixture.password });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects mutations with a non-allowlisted Origin", async () => {
    const res = await makeApiClient().client
      .post("/api/auth/login")
      .set(withCsrfHeader)
      .set("Origin", "http://evil.example")
      .send({ email: adminFixture.email, password: adminFixture.password });

    expect(res.status).toBe(403);
  });

  it("allows mutations with an allowlisted Origin", async () => {
    const res = await makeApiClient().client
      .post("/api/auth/login")
      .set(withCsrfHeader)
      .set("Origin", "http://localhost:3000")
      .send({ email: adminFixture.email, password: adminFixture.password });

    expect(res.status).toBe(200);
  });
});

describe("GET /api/auth/me", () => {
  it("rejects unauthenticated access", async () => {
    const res = await makeApiClient().client.get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("resolves a valid session cookie into the admin summary", async () => {
    const loginRes = await makeApiClient().client
      .post("/api/auth/login")
      .set(withCsrfHeader)
      .send({ email: adminFixture.email, password: adminFixture.password });
    const cookie = extractSessionCookie(loginRes);

    const res = await makeApiClient().client.get("/api/auth/me").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: { admin: { name: adminFixture.name, email: adminFixture.email } },
    });
    expect(res.text).not.toContain("passwordHash");
  });

  it("rejects an expired session even before the TTL sweeper runs", async () => {
    const rawToken = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    await SessionModel.create({
      tokenHash: hashSessionToken(rawToken),
      adminId: (await AdminModel.findOne({ email: adminFixture.email }))!._id,
      expiresAt: new Date(Date.now() - 60 * 1000), // already in the past
    });

    const res = await makeApiClient().client
      .get("/api/auth/me")
      .set("Cookie", `dt_session=${rawToken}`);

    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("destroys the session server-side and invalidates the old cookie", async () => {
    const loginRes = await makeApiClient().client
      .post("/api/auth/login")
      .set(withCsrfHeader)
      .send({ email: adminFixture.email, password: adminFixture.password });
    const cookie = extractSessionCookie(loginRes);

    const logoutRes = await makeApiClient().client
      .post("/api/auth/logout")
      .set(withCsrfHeader)
      .set("Cookie", cookie);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.data.loggedOut).toBe(true);

    const afterRes = await makeApiClient().client
      .get("/api/auth/me")
      .set("Cookie", cookie);
    expect(afterRes.status).toBe(401);
  });

  it("also requires authentication", async () => {
    const res = await makeApiClient().client
      .post("/api/auth/logout")
      .set(withCsrfHeader)
      .send({});

    expect(res.status).toBe(401);
  });
});

describe("login rate limiting", () => {
  it("returns 429 after the configured attempt budget is exhausted", async () => {
    // Test-isolated limiter (2 attempts / w-window) injected via app options —
    // the production limiter keeps its env configuration.
    const strictLimiter: RequestHandler = rateLimit({
      windowMs: 60_000,
      limit: 2,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: {
        success: false,
        error: { code: "RATE_LIMITED", message: "Too many login attempts — wait before retrying." },
      },
    });

    const client = makeApiClient({ loginLimiter: strictLimiter }).client;
    const attempt = () =>
      client
        .post("/api/auth/login")
        .set(withCsrfHeader)
        .send({ email: `nobody-${Date.now()}@mail.example.com`, password: "whatever-password-123" });

    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(401);

    const throttled = await attempt();
    expect(throttled.status).toBe(429);
    expect(throttled.body.error.code).toBe("RATE_LIMITED");
  });
});

describe("sessions store", () => {
  it("deploys the unique-hash and TTL indexes", async () => {
    await SessionModel.init();
    const indexes = await SessionModel.listIndexes();

    const tokenIndex = indexes.find((index) => JSON.stringify(index.key) === JSON.stringify({ tokenHash: 1 }));
    expect(tokenIndex?.unique).toBe(true);

    const ttlIndex = indexes.find((index) => JSON.stringify(index.key) === JSON.stringify({ expiresAt: 1 }));
    expect(ttlIndex?.expireAfterSeconds).toBe(0);
  });

  it("stores only a hash of the token in the database", async () => {
    const loginRes = await makeApiClient().client
      .post("/api/auth/login")
      .set(withCsrfHeader)
      .send({ email: adminFixture.email, password: adminFixture.password });
    const cookieToken = extractSessionCookie(loginRes) // "dt_session=<token>"
      .split("=")[1] ?? "";

    expect(cookieToken.length).toBe(64); // 256-bit hex token in the cookie only

    const rawDocs = await SessionModel.findOne({}).lean();
    expect(String(rawDocs?.tokenHash)).not.toBe(cookieToken); // stored form differs
    expect(String(rawDocs?.tokenHash).length).toBe(64); // sha256 hex
  });
});
