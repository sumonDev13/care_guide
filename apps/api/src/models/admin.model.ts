import mongoose, { Schema } from "mongoose";

/**
 * Administrator accounts. Created via scripts/create-admin.ts only — there is
 * intentionally NO public registration endpoint.
 */
export interface AdminDoc {
  name: string;
  email: string;
  passwordHash: string; // argon2id PHC string (see services/auth.service.ts)
  createdAt?: Date;
  updatedAt?: Date;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const adminSchema = new Schema<AdminDoc>(
  {
    name: {
      type: String,
      required: [true, "Admin name is required"],
      trim: true,
      minlength: [2, "Admin name is too short"],
      maxlength: [120, "Admin name is too long"],
    },
    email: {
      type: String,
      required: [true, "Admin email is required"],
      trim: true,
      lowercase: true,
      match: [EMAIL_PATTERN, "A valid email address is required"],
      unique: true, // DB-level uniqueness, same normalization policy as doctors
    },
    passwordHash: {
      type: String,
      required: [true, "Password hash is required"],
    },
  },
  {
    timestamps: true,
    toJSON: {
      // Serialization backstop: even if a future query accidentally selects
      // the hash, it can never leave the process through this schema's
      // serializer. Queries still use projections (defense in depth).
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

export const AdminModel = mongoose.model<AdminDoc>("Admin", adminSchema);
