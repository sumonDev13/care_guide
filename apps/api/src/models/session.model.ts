import mongoose, { Schema } from "mongoose";

/**
 * Server-side sessions. The cookie carries a raw 256-bit token; the database
 * stores only its SHA-256 hash (unique index), so a database leak cannot
 * authenticate anyone. Mongo's TTL index deletes expired sessions even if a
 * request never touches them again.
 */
export interface SessionDoc {
  tokenHash: string; // sha256 hex of the cookie token
  adminId: import("mongoose").Types.ObjectId;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const sessionSchema = new Schema<SessionDoc>(
  {
    tokenHash: { type: String, required: true, unique: true },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: [true, "A session must belong to an admin"],
    },
    expiresAt: {
      type: Date,
      required: [true, "A session must have an expiry"],
    },
  },
  { timestamps: true },
);

/**
 * Indexes:
 *  - unique lookup on the (hashed) cookie value — full index reads at O(log n).
 *  - TTL (expireAfterSeconds: 0) on expiresAt — precise, self-cleaning expiry.
 */
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel = mongoose.model<SessionDoc>("Session", sessionSchema);
