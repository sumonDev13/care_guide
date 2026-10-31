import { z } from "zod";
import { DOCTOR_EMAIL_PATTERN, DOCTOR_PHONE_PATTERN } from "../models/doctor.model.js";
import { PATIENT_CONDITIONS } from "../models/patient.model.js";

/**
 * Request contracts for the doctors surface (Step 6). Normalization happens
 * here (trim/lowercase) with the schema's DB rules as the backstop — this
 * layer is where users get friendly, field-specific errors. Possible
 * values for filters/sorting are whitelisted: never pass raw client input
 * into Mongo options.
 */

const DOCTOR_NAME_MAX = 120;
const SPECIALIZATION_MAX = 80;
const HOSPITAL_MAX = 200;

/**
 * Path-parameter contract. Validating the ObjectId shape up front turns what
 * would be a driver CastError into a clean, routed 400.
 */
export const doctorIdParamSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{24}$/i, "Malformed identifier — expected a 24-character ObjectId");
export type DoctorIdParam = z.infer<typeof doctorIdParamSchema>;

export const createDoctorSchema = z.object({
  name: z
    .string({ message: "Doctor name is required" })
    .trim()
    .min(2, "Doctor name must be at least 2 characters")
    .max(DOCTOR_NAME_MAX, `Doctor name is too long (max ${DOCTOR_NAME_MAX})`),
  specialization: z
    .string({ message: "Specialization is required" })
    .trim()
    .min(2, "Specialization must be at least 2 characters")
    .max(SPECIALIZATION_MAX, `Specialization is too long (max ${SPECIALIZATION_MAX})`),
  hospital: z
    .string({ message: "Hospital is required" })
    .trim()
    .min(2, "Hospital must be at least 2 characters")
    .max(HOSPITAL_MAX, `Hospital is too long (max ${HOSPITAL_MAX})`),
  phone: z
    .string({ message: "Phone number is required" })
    .trim()
    .regex(
      DOCTOR_PHONE_PATTERN,
      "Phone must be 7–20 characters (digits, spaces, dashes, parentheses, optional leading +)",
    ),
  email: z
    .string({ message: "Email is required" })
    .trim()
    .max(254, "Email is too long")
    .regex(DOCTOR_EMAIL_PATTERN, "A valid email address is required"),
});
export type CreateDoctorDto = z.infer<typeof createDoctorSchema>;

/**
 * PATCH: every field optional, but the body may not be empty — a no-op edit
 * is a client bug worth a 422, not a silent success.
 */
export const updateDoctorSchema = createDoctorSchema
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "Provide at least one field to update",
  });
export type UpdateDoctorDto = z.infer<typeof updateDoctorSchema>;

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

/**
 * `-prefix = descending`. Whitelisted fields only (matches shipped indexes:
 * name sorts lexicographically; createdAt sorts newest-first by default).
 */
const doctorSortSchema = z
  .string()
  .trim()
  .regex(
    /^-?(name|specialization|hospital|createdAt)$/,
    "Unsupported sort field — use name, specialization, hospital or createdAt (optionally prefixed with - to sort descending)",
  );

export const listDoctorsQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(120, "Search is too long")
    .optional(),
  specialization: z
    .string()
    .trim()
    .max(SPECIALIZATION_MAX, `Specialization filter is too long (max ${SPECIALIZATION_MAX})`)
    .optional(),
  hospital: z
    .string()
    .trim()
    .max(HOSPITAL_MAX, `Hospital filter is too long (max ${HOSPITAL_MAX})`)
    .optional(),
  sort: doctorSortSchema.optional(),
  ...paginationSchema,
});
export type ListDoctorsQuery = z.infer<typeof listDoctorsQuerySchema>;

/** Patients of one doctor: same envelope, condition filter, patient sorts. */
export const listDoctorPatientsQuerySchema = z.object({
  condition: z
    .enum(PATIENT_CONDITIONS, {
      message: "Unsupported condition filter",
    })
    .optional(),
  sort: z
    .string()
    .trim()
    .regex(
      /^-?(createdAt|name)$/,
      "Unsupported sort field — use name or createdAt (optionally prefixed with - to sort descending)",
    )
    .optional(),
  ...paginationSchema,
});
export type ListDoctorPatientsQuery = z.infer<typeof listDoctorPatientsQuerySchema>;
