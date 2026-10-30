import { createHash, randomBytes } from "node:crypto";
import type { Types } from "mongoose";
import { SessionModel } from "../models/session.model.js";
import { env } from "../config/env.js";

/**
 * Session business logic. The raw token exists ONLY in the issued cookie —
 * never persisted, never logged (a cookie-header redaction is configured at
 * the request-logger level as an extra guard).
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cookie key carrying the raw token (exported so middleware/controller agree). */
export const SESSION_COOKIE_NAME = "dt_session";

export type IssuedSession = {
  token: string; // goes into the HttpOnly cookie only
  expiresAt: Date;
};

export async function createSession(adminId: Types.ObjectId): Promise<IssuedSession> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + env.authSessionTtlMinutes * 60 * 1000);

  await SessionModel.create({
    tokenHash: hashSessionToken(token),
    adminId,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function findSession(token: string): Promise<{
  adminId: Types.ObjectId;
  expiresAt: Date;
} | null> {
  const tokenHash = hashSessionToken(token);
  const doc = await SessionModel.findOne(
    { tokenHash, expiresAt: { $gt: new Date() } },
    { tokenHash: 1, adminId: 1, expiresAt: 1 }, // projection discipline
  ).lean();

  if (!doc) return null;
  const { adminId, expiresAt } = doc;
  return { adminId, expiresAt };
}

export async function destroySession(token: string): Promise<boolean> {
  const result = await SessionModel.deleteOne({ tokenHash: hashSessionToken(token) });
  return result.deletedCount > 0;
}
