import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../middleware/request-logger.js";

/**
 * MongoDB access for the whole API (single owner: this module).
 *
 * Lifecycle rules enforced here:
 *  - exactly one memoized connection per process — survives tsx-watch module
 *    reloads (watch mode must not stack connections);
 *  - a failed connection attempt clears the cache, so retrying is possible;
 *  - disconnect revokes the memoization for a clean next run;
 *  - event listeners log state changes but NEVER the full URI — only a
 *    credential-redacted summary.
 */
export type MongoState = "connected" | "connecting" | "disconnecting" | "disconnected";

let cachedConnection: Promise<typeof mongoose> | undefined;
let lifecycleEventsBound = false;

/** Safe to log/use in errors: scheme + host only, credentials always masked. */
export function describeMongoUri(uri: string): string {
  try {
    const url = new URL(uri);
    return `${url.protocol}//${url.username ? "***:***@" : ""}${url.host}`;
  } catch {
    return "(unparseable MongoDB URI — check MONGODB_URI)";
  }
}

export function getMongoState(): MongoState {
  switch (mongoose.connection.readyState) {
    case mongoose.ConnectionStates.connecting:
      return "connecting";
    case mongoose.ConnectionStates.connected:
      return "connected";
    case mongoose.ConnectionStates.disconnecting:
      return "disconnecting";
    default:
      return "disconnected";
  }
}

function bindLifecycleEventsOnce(): void {
  if (lifecycleEventsBound) return;
  lifecycleEventsBound = true;

  mongoose.connection.on("connected", () => {
    logger.info(`MongoDB connected (${describeMongoUri(env.mongodbUri ?? "")})`);
  });
  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
  });
  mongoose.connection.on("error", (err) => {
    logger.error({ err }, "MongoDB connection error");
  });
}

export async function connectDatabase(
  options?: {
    uri?: string;
    dbName?: string;
    serverSelectionTimeoutMs?: number;
  },
): Promise<typeof mongoose> {
  const uri = options?.uri ?? env.mongodbUri;
  const dbName = options?.dbName ?? env.mongodbDbName;

  if (!uri) {
    throw new Error("connectDatabase called without MONGODB_URI");
  }
  if (!dbName) {
    throw new Error("connectDatabase called without MONGODB_DB_NAME");
  }

  bindLifecycleEventsOnce();

  if (!cachedConnection) {
    logger.info(`Connecting to MongoDB at ${describeMongoUri(uri)} …`);
    cachedConnection = mongoose
      .connect(uri, {
        // Explicit db name so a single cluster can host dev/test/prod data in
        // separate databases; takes precedence over any URI-path database.
        dbName,
        // Modest, documented ceiling for an admin app; revisit with real load
        // numbers instead of guessing larger pools.
        maxPoolSize: 10,
        serverSelectionTimeoutMS: options?.serverSelectionTimeoutMs ?? 10_000,
      })
      .catch((err: unknown) => {
        // A rejected memoized promise would make every future call fail the
        // same way without retry — clear the failure.
        cachedConnection = undefined;
        throw err;
      });
  }

  return cachedConnection;
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === mongoose.ConnectionStates.disconnected) {
    cachedConnection = undefined;
    return;
  }
  await mongoose.disconnect();
  cachedConnection = undefined;
  logger.info("MongoDB connection closed");
}
