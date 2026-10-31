import mongoose, { Schema } from "mongoose";

/**
 * Doctor Schema
 *
 * Normalization policy (decision #13): email is lowercased on write and the
 * uniqueness index rides on the normalized value — case-insensitive privilege
 * at the database level without collation subtleties. Names/hospitals keep the
 * admin's spelling (display purity) with trim-only normalization.
 */
export interface DoctorDoc {
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s\-()]{7,20}$/;

/**
 * Shared with the request validators so DB-level rules and API-level rules
 * cannot drift apart; the validators import these instead of restating.
 */
export const DOCTOR_EMAIL_PATTERN = EMAIL_PATTERN;
export const DOCTOR_PHONE_PATTERN = PHONE_PATTERN;

const doctorSchema = new Schema<DoctorDoc>(
  {
    name: {
      type: String,
      required: [true, "Doctor name is required"],
      trim: true,
      minlength: [2, "Doctor name is too short"],
      maxlength: [120, "Doctor name is too long"],
    },
    specialization: {
      type: String,
      required: [true, "Specialization is required"],
      trim: true,
      minlength: [2, "Specialization is too short"],
      maxlength: [80, "Specialization is too long"],
    },
    hospital: {
      type: String,
      required: [true, "Hospital is required"],
      trim: true,
      minlength: [2, "Hospital is too short"],
      maxlength: [200, "Hospital is too long"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [PHONE_PATTERN, "Phone must be 7–20 characters (digits, spaces, dashes, parentheses, optional leading +)"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true, // normalization: case differences can never defeat uniqueness
      match: [EMAIL_PATTERN, "A valid email address is required"],
      unique: true, // database-level uniqueness; a distorted value becomes E11000
    },
  },
  { timestamps: true },
);

/**
 * Indexes — justified by real/planned query patterns (§ approach: no
 * indiscriminate indexing; the list is small and every entry answers a
 * concrete list endpoint):
 *  - ({ email: 1 }) unique — declared above; login/lookup + uniqueness rule.
 *  - ({ createdAt: -1 }) — default list sort (newest first).
 *  - ({ specialization: 1, createdAt: -1 }) — specialization filter + newest sort.
 *  - ({ hospital: 1, createdAt: -1 }) — hospital filter + newest sort.
 * Text search over name/phone is left unindexed until measured with
 * explain() (optimization step); regex search there does not use an index
 * today and that cost is understood before adding one.
 */
doctorSchema.index({ specialization: 1, createdAt: -1 });
doctorSchema.index({ hospital: 1, createdAt: -1 });
doctorSchema.index({ createdAt: -1 });

export const DoctorModel = mongoose.model<DoctorDoc>("Doctor", doctorSchema);
