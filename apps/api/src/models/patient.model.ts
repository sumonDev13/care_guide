import mongoose, { type Types, Schema } from "mongoose";
import type { DoctorDoc } from "./doctor.model.js";

/**
 * Patient Schema
 *
 * Data-minimization policy (decision #14): only the administration-surface
 * fields the app actually needs. No diagnosis text, no medicine lists. The
 * "condition" is a coarse, closed category for grouping/filtering/charts —
 * it is the only health-related attribute we deliberately keep.
 */
export const PATIENT_CONDITIONS = ["general", "chronic", "injury", "preventive", "pediatric", "other"] as const;
export type PatientCondition = (typeof PATIENT_CONDITIONS)[number];
export const PATIENT_GENDERS = ["male", "female", "other"] as const;
export type PatientGender = (typeof PATIENT_GENDERS)[number];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s\-()]{7,20}$/;

/**
 * Shared with the request validators so DB-level rules and API-level rules
 * cannot drift apart; the validators import these instead of restating.
 */
export const PATIENT_EMAIL_PATTERN = EMAIL_PATTERN;
export const PATIENT_PHONE_PATTERN = PHONE_PATTERN;

export interface PatientDoc {
  name: string;
  phone?: string;
  email?: string;
  condition: PatientCondition;
  doctor: Types.ObjectId;
  age?: number;
  gender?: PatientGender;
  createdAt?: Date;
  updatedAt?: Date;
}

const patientSchema = new Schema<PatientDoc>(
  {
    name: {
      type: String,
      required: [true, "Patient name is required"],
      trim: true,
      minlength: [2, "Patient name is too short"],
      maxlength: [120, "Patient name is too long"],
    },
    phone: {
      type: String,
      trim: true,
      match: [PHONE_PATTERN, "Phone must be 7–20 characters"],
      // Cross-field contact rule as conditional requirement — required-fn
      // validators DO run on unset paths (custom validate fns don't).
      required: [
        function contactRequired(this: PatientDoc): boolean {
          return !this.email;
        },
        "Provide at least one contact channel (phone or email).",
      ],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [EMAIL_PATTERN, "A valid email address is required"],
      required: [
        function contactRequired(this: PatientDoc): boolean {
          return !this.phone;
        },
        "Provide at least one contact channel (phone or email).",
      ],
      // Deliberately NOT unique — households legitimately share contact details.
    },
    condition: {
      type: String,
      required: [true, "Patient condition is required"],
      enum: {
        values: PATIENT_CONDITIONS,
        message: "Unsupported condition category",
      },
    },
    doctor: {
      type: Schema.Types.ObjectId,
      ref: "Doctor",
      required: [true, "Every patient must be linked to a doctor"],
    },
    age: {
      type: Number,
      min: 0,
      max: 130,
      validate: {
        validator: (value: number) => Number.isInteger(value),
        message: "Age must be a whole number",
      },
    },
    gender: { type: String, enum: { values: PATIENT_GENDERS, message: "Unsupported gender value" } },
  },
  { timestamps: true },
);

/**
 * Indexes for this document's actual query patterns:
 *  - ({ doctor: 1, createdAt: -1 }) — a doctor's patient list, newest first
 *    (§5.4: no scan over the whole patients collection per doctor page).
 *  - ({ createdAt: -1 }) — patients-page default sort.
 *  - ({ condition: 1, createdAt: -1 }) — condition filter + newest sort.
 */
patientSchema.index({ doctor: 1, createdAt: -1 });
patientSchema.index({ createdAt: -1 });
patientSchema.index({ condition: 1, createdAt: -1 });

/**
 * Referential integrity before any write that changes the relationship
 * (decision #15): M0 clusters do not support multi-document transactions, so
 * the guarantee is implemented as an existence check against the Doctor
 * primary-key index at write time. Combined with the (later, Step 7) rule
 * that a doctor with assigned patients cannot be deleted (409), the pair —
 * reference validation on the patient side + deletion guard on the doctor
 * side — closes both directions of orphaning without transactions.
 */
patientSchema.pre("save", async function () {
  if (this.isModified("doctor")) {
    const doctorExists = await this.$model("Doctor").exists({ _id: this.doctor });
    if (!doctorExists) {
      const validationError = new mongoose.Error.ValidationError();
      validationError.addError(
        "doctor",
        new mongoose.Error.ValidatorError({
          path: "doctor",
          message: "The linked doctor does not exist",
          value: this.doctor,
        }),
      );
      throw validationError;
    }
  }
});

export const PatientModel = mongoose.model<PatientDoc>("Patient", patientSchema);

// Re-exported so loaders of both models keep registration order Doctor → Patient.
export type { DoctorDoc };
