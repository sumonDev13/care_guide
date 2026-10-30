import { MongoMemoryServer } from "mongodb-memory-server";
import { randomUUID } from "node:crypto";

/**
 * Throwaway MongoDB for API integration tests. Absolutely NO use of the Atlas
 * dev database here: test runs are hermetic — an in-memory server on a random
 * port with a random database name per invocation.
 *
 * The MongoDB binary is downloaded to the local npm cache on first use
 * (~100 MB, one-time).
 */
let memoryServer: MongoMemoryServer | undefined;

export async function startTestDb(): Promise<{ uri: string; dbName: string }> {
  const server = await MongoMemoryServer.create();
  memoryServer = server;
  return { uri: server.getUri(), dbName: `doctor_tracker_test_${randomUUID().slice(0, 8)}` };
}

export async function stopTestDb(): Promise<void> {
  await memoryServer?.stop();
  memoryServer = undefined;
}
