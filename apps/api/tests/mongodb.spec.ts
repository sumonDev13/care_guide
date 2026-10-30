import { afterAll, describe, expect, it } from "vitest";
import {
  connectDatabase,
  disconnectDatabase,
  describeMongoUri,
  getMongoState,
} from "../src/config/mongodb.js";
import { startTestDb, stopTestDb } from "./helpers/mongodb.js";
import { makeApiClient } from "./helpers/api-client.js";

// The very first run downloads the in-memory MongoDB binary (~100 MB).
const firstRunTimeoutMs = 300_000;

describe("MongoDB connection lifecycle", () => {
  afterAll(async () => {
    await disconnectDatabase();
    await stopTestDb();
  });

  it(
    "connects, surfaces state through /api/health, and disconnects cleanly",
    { timeout: firstRunTimeoutMs },
    async () => {
      const { uri, dbName } = await startTestDb();

      // Logs must show a redacted URI, never raw credentials.
      expect(describeMongoUri(uri)).not.toMatch(/@[^@/]*:/);

      await connectDatabase({ uri, dbName });
      expect(getMongoState()).toBe("connected");

      const res = await makeApiClient().client.get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body.data.database.state).toBe("connected");
      expect(res.body.data.status).toBe("ok");

      await disconnectDatabase();
      expect(getMongoState()).toBe("disconnected");
    },
  );

  it("fails fast with an actionable error against an unreachable MongoDB", async () => {
    await expect(
      connectDatabase({
        uri: "mongodb://127.0.0.1:1/",
        dbName: "doctor_tracker_unreachable",
        serverSelectionTimeoutMs: 500,
      }),
    ).rejects.toThrow(/Server selection timed out|ECONNREFUSED/);
  });
});
