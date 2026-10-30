import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { connectDatabase, disconnectDatabase } from "../src/config/mongodb.js";
import { startTestDb, stopTestDb } from "./helpers/mongodb.js";
import { makeApiClient, withCsrfHeader } from "./helpers/api-client.js";

/**
 * Verifies the documented bootstrap path END to end, as a spawned real
 * process: non-interactive flags against its own hermetic database, then the
 * created credentials successfully authenticate through the live endpoint.
 * Never touches the Atlas dev data.
 */
describe("create-admin script", () => {
  it(
    "bootstraps an admin non-interactively whose credentials log in",
    { timeout: 120_000 },
    async () => {
      const { uri, dbName } = await startTestDb();
      const email = `boot-${randomUUID()}@mail.example.com`;
      const password = "bootstrap-password-42";

      const { code, output } = await new Promise<{ code: number | null; output: string }>((resolve, reject) => {
        const child = spawn(
          "npx",
          [
            "tsx",
            "src/scripts/create-admin.ts",
            "--name",
            "Bootstrap Admin",
            "--email",
            email,
            "--password-env",
            "ADMIN_BOOTSTRAP_PASSWORD",
          ],
          {
            cwd: process.cwd(), // vitest runs with apps/api as cwd
            env: {
              ...process.env,
              NODE_ENV: "development",
              LOG_LEVEL: "info", // vitest sets process LOG_LEVEL=silent — the spawned script must still log its outcome
              MONGODB_URI: uri, // hermetic; process env beats .env in the loader
              MONGODB_DB_NAME: dbName,
              ADMIN_BOOTSTRAP_PASSWORD: password,
            },
          },
        );
        let output = "";
        child.stdout.on("data", (chunk) => (output += String(chunk)));
        child.stderr.on("data", (chunk) => (output += String(chunk)));
        child.on("error", reject);
        child.on("close", (code) => resolve({ code, output }));
      });

      expect(code).toBe(0);
      expect(output).toContain("Administrator created");
      // The password must not be echoed anywhere.
      expect(output).not.toContain(password);

      // The bootstrap credentials log in through the real endpoint. The
      // endpoint is served by THIS process, so it needs its own connection to
      // the same hermetic database (the child connected and disconnected its
      // own during the spawn).
      await connectDatabase({ uri, dbName });
      const login = await makeApiClient().client
        .post("/api/auth/login")
        .set(withCsrfHeader)
        .send({ email, password });
      expect(login.status).toBe(200);
      await disconnectDatabase();

      await stopTestDb();
    },
  );

  it(
    "refuses to overwrite an existing administrator",
    { timeout: 120_000 },
    async () => {
      const { uri, dbName } = await startTestDb();
      const email = `boot-dup-${randomUUID()}@mail.example.com`;

      const runOnce = () =>
        new Promise<{ code: number | null; output: string }>((resolve, reject) => {
          const child = spawn(
            "npx",
            ["tsx", "src/scripts/create-admin.ts", "--email", email, "--password-env", "ADMIN_BOOTSTRAP_PASSWORD"],
            {
              cwd: process.cwd(),
              env: {
                ...process.env,
                NODE_ENV: "development",
                LOG_LEVEL: "info", // vitest sets process LOG_LEVEL=silent — the spawned script must still log its outcome
                MONGODB_URI: uri,
                MONGODB_DB_NAME: dbName,
                ADMIN_BOOTSTRAP_PASSWORD: "bootstrap-password-42",
              },
            },
          );
          let output = "";
          child.stdout.on("data", (chunk) => (output += String(chunk)));
          child.stderr.on("data", (chunk) => (output += String(chunk)));
          child.on("error", reject);
          child.on("close", (code) => resolve({ code, output }));
        });

      const first = await runOnce();
      expect(first.code).toBe(0);

      const second = await runOnce();
      expect(second.code).toBe(1);
      expect(second.output).toContain("already exists");

      await stopTestDb();
    },
  );
});
