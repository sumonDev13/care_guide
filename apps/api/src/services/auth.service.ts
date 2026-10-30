import { hash, verify } from "@node-rs/argon2";
import { randomUUID } from "node:crypto";
import type { Types } from "mongoose";
import { AdminModel, type AdminDoc } from "../models/admin.model.js";
import type { CredentialsDto } from "../services/types.js";

/**
 * Password hashing: argon2id with OWASP-recommended parameters
 * (m=19 MiB, t=2, p=1) — verified against the bundled @node-rs/argon2
 * native bindings, so no fallback build tooling is involved. The library's
 * default algorithm IS argon2id; a test asserts the emitted PHC string to
 * keep that guarantee pinned.
 */
const ARGON2_OPTIONS = {
  memoryCost: 19_456, // KiB (19 MiB)
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

/**
 * Uniform-failure semantics: an unknown email and a wrong password produce
 * the SAME status, message, and (within measurement limits) timing. For
 * unknown emails we still burn one full argon2 verification against a dummy
 * hash so response time cannot be used to enumerate registered accounts.
 */
let dummyHashPromise: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hash(randomUUID(), ARGON2_OPTIONS);
  return dummyHashPromise;
}

export type AdminIdentity = Pick<AdminDoc, "name" | "email"> & { id: Types.ObjectId };

export async function authenticateCredentials(
  credentials: CredentialsDto,
): Promise<AdminIdentity | null> {
  const email = credentials.email.toLowerCase();
  const admin = await AdminModel.findOne({ email }).lean();
  if (!admin) {
    // Timing-equalization branch (result deliberately unused).
    const dummyHash = await getDummyHash();
    await verify(dummyHash, credentials.password);
    return null;
  }

  const verified = await verify(admin.passwordHash, credentials.password);
  if (!verified) return null;

  return { id: admin._id as Types.ObjectId, name: admin.name, email: admin.email };
}

export async function findAdminSummary(id: Types.ObjectId): Promise<{
  id: string;
  name: string;
  email: string;
} | null> {
  const admin = await AdminModel.findOne({ _id: id }, { name: 1, email: 1 }).lean();
  if (!admin) return null;
  return { id: String(admin._id), name: admin.name, email: admin.email };
}
