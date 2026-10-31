import { z } from "zod";
import {
  PATIENT_CONDITIONS,
  PATIENT_EMAIL_PATTERN,
  PATIENT_GENDERS,
  PATIENT_PHONE_PATTERN,
} from "../models/patient.model.js";
import { doctorIdParamSchema } from "./doctors.validators.js";

/**
 * Request contracts for the patients surface (Step 7). Same philosophy as the
 * doctors validators (decision #16): trim/normalize here, whitelist
 * filter/sort/sort options, and let the Mongoose model rules act as the
 * last-line backstop.
 */

const NAME_MAX = 120;

/** Path-parameter contract — same ObjectId shape as the doctors surface. */
export const patientIdParamSchema = doctorIdParamSchema;
export type PatientIdParam = z.infer<typeof patientIdParamSchema>;

/** A doctor reference in a patient body — message phrased for the patient. */
const doctorReferenceSchema = z
  .string({ message: "A doctor reference is required" })
  .trim()
  .regex(/^[0-9a-f]{24}$/i, "A valid doctor reference is required (24-character ObjectId)");

const patientNameSchema = z
  .string({ message: "Patient name is required" })
  .trim()
  .min(2, "Patient name must be at least 2 characters")
  .max(NAME_MAX, `Patient name is too long (max ${NAME_MAX})`);

const conditionSchema = z.enum(PATIENT_CONDITIONS, {
  message: "Unsupported condition category",
});

const genderSchema = z.enum(PATIENT_GENDERS, {
  message: "Unsupported gender value",
});

const ageSchema = z
  .number({ message: "Age must be a whole number" })
  .int("Age must be a whole number")
  .min(0, "Age must be at least 0")
  .max(130, "Age must be at most 130");

const phoneSchema = z
  .string({ message: "Phone must be a string" })
  .trim()
  .regex(
    PATIENT_PHONE_PATTERN,
    "Phone must be 7–20 characters (digits, spaces, dashes, parentheses, optional leading +)",
  );

const emailSchema = z
  .string({ message: "Email must be a string" })
  .trim()
  .max(254, "Email is too long")
  .regex(PATIENT_EMAIL_PATTERN, "A valid email address is required");

/**
 * JSON `null` on an optional field means "clear it" — the unified way to
 * unset contact channels or demographics through PATCH. (JSON has no
 * `undefined`; treating null as clear keeps one honest verb per operation.)
 */
const nullablePhone = z.union([phoneSchema, z.literal(null)]).optional();
const nullableEmail = z.union([emailSchema, z.literal(null)]).optional();
const nullableAge = z.union([ageSchema, z.literal(null)]).optional();
const nullableGender = z.union([genderSchema, z.literal(null)]).optional();

/**
 * Contact rule (decision #13): at least one contact channel must survive any
 * write. Expressed here (request layer) AND in the model (conditional
 * required) so no layer can be skipped into an unreachable patient.
 */
function assertContactRule(
  data: { phone?: string | null; email?: string | null },
  ctx: z.RefinementCtx,
): void {
  if (!data.phone && !data.email) {
    ctx.addIssue({
      code: "custom",
      path: ["phone"],
      message: "Provide at least one contact channel (phone or email).",
    });
  }
}

export const createPatientSchema = z
  .object({
    name: patientNameSchema,
    condition: conditionSchema,
    doctor: doctorReferenceSchema,
    phone: nullablePhone,
    email: nullableEmail,
    age: nullableAge,
    gender: nullableGender,
  })
  .superRefine(assertContactRule);
export type CreatePatientDto = z.infer<typeof createPatientSchema>;

/**
 * PATCH: any subset of the writable fields; optional fields additionally
 * accept `null` to clear. A completely empty patch is a client bug → 422.
 */
export const updatePatientSchema = z
  .object({
    name: patientNameSchema.optional(),
    condition: conditionSchema.optional(),
    doctor: doctorReferenceSchema.optional(),
    phone: nullablePhone,
    email: nullableEmail,
    age: nullableAge,
    gender: nullableGender,
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "Provide at least one field to update",
  });
export type UpdatePatientDto = z.infer<typeof updatePatientSchema>;

/**
 * The full, merged post-edit state — validated as a WHOLE before the write
 * so cross-field rules (contact rule) can never be violated by a
 * piecewise patch.
 */
export const patientStateSchema = z
  .object({
    name: patientNameSchema,
    condition: conditionSchema,
    doctor: doctorReferenceSchema,
    phone: nullablePhone,
    email: nullableEmail,
    age: nullableAge,
    gender: nullableGender,
  })
  .superRefine(assertContactRule);
export type PatientStateDto = z.infer<typeof patientStateSchema>;

const paginationSchema = {
  page: z.coerce
    .number()
    .int()
    .min(1, "Page must be a positive integer")
    .default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, "Limit must be at least 1")
    .max(100, "Limit must be at most 100")
    .default(10),
};

export const listPatientsQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(120, "Search is too long")
    .optional(),
  condition: z
    .enum(PATIENT_CONDITIONS, {
      message: "Unsupported condition filter",
    })
    .optional(),
  doctor: doctorIdParamSchema.optional(),
  sort: z
    .string()
    .trim()
    .regex(
      /^-?(name|condition|createdAt)$/,
      "Unsupported sort field — use name, condition or createdAt (optionally prefixed with - to sort descending)",
    )
    .optional(),
  ...paginationSchema,
});
export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;
