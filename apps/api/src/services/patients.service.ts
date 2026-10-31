import { DoctorModel } from "../models/doctor.model.js";
import { PatientModel, type PatientDoc } from "../models/patient.model.js";
import { ApiError } from "../utils/errors.js";
import {
  buildPaginationMeta,
  buildSort,
  escapeRegExp,
  type PaginationMeta,
} from "../utils/pagination.js";
import {
  patientStateSchema,
  type CreatePatientDto,
  type ListPatientsQuery,
  type PatientStateDto,
  type UpdatePatientDto,
} from "../validators/patients.validators.js";

const PATIENT_SORT_FIELDS = ["name", "condition", "createdAt"] as const;

/**
 * Wire summary — the exact field set every patients endpoint returns; the
 * assigned doctor is carried as `doctorId` (string) so route-level consumers
 * never deal with Mongo ObjectId types.
 */
export type PatientSummary = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  condition: string;
  doctorId: string;
  age?: number;
  gender?: string;
  createdAt?: string;
  updatedAt?: string;
};

type LeanPatient = Omit<PatientDoc, "doctor" | "_id"> & { doctor: unknown; _id: unknown };

function toPatientSummary(doc: LeanPatient): PatientSummary {
  return {
    id: String(doc._id),
    name: doc.name,
    phone: doc.phone,
    email: doc.email,
    condition: doc.condition,
    doctorId: String(doc.doctor),
    age: doc.age,
    gender: doc.gender,
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
  };
}

/** 422 with the same `details` shape the zod pipeline produces ({field, message}). */
async function assertDoctorExists(doctorId: string): Promise<void> {
  const exists = await DoctorModel.exists({ _id: doctorId });
  if (!exists) {
    throw ApiError.validation("The provided data is invalid.", [
      { field: "doctor", message: "The linked doctor does not exist" },
    ]);
  }
}

export async function createPatient(dto: CreatePatientDto): Promise<PatientSummary> {
  // Existence is checked explicitly here AND in the model's pre("save") hook —
  // the hook backstops every future writer; this gives the caller a stable 422
  // shape instead of a mapped Mongoose error.
  await assertDoctorExists(dto.doctor);

  const created = await PatientModel.create({
    name: dto.name,
    condition: dto.condition,
    doctor: dto.doctor,
    // JSON nulls mean "absent" on create (see validators) — normalize to undefined
    // so the optional paths stay unset rather than storing nulls.
    phone: dto.phone ?? undefined,
    email: dto.email ?? undefined,
    age: dto.age ?? undefined,
    gender: dto.gender ?? undefined,
  });

  return toPatientSummary(created);
}

export async function getPatient(id: string): Promise<PatientSummary> {
  const doc = await PatientModel.findById(id).lean();
  if (!doc) throw ApiError.notFound("Patient not found.");
  return toPatientSummary(doc);
}

/**
 * PATCH semantics (patient editing): the patch is applied to the current
 * state, and the MERGED state is re-validated as a whole before the write —
 * cross-field rules (the contact rule) therefore hold for any piecewise
 * patch. Optional fields may be cleared with `null`, implemented via
 * `$unset` (Mongoose drops `$set: undefined`).
 */
export async function updatePatient(id: string, patch: UpdatePatientDto): Promise<PatientSummary> {
  const current = await PatientModel.findById(id).lean();
  if (!current) throw ApiError.notFound("Patient not found.");

  // Translate the patch into exact per-field intent:
  //   - explicit null  → "clear this field" (tracked, applied via $unset below)
  //   - a value        → "set this field"
  //   - absent         → "leave the current value untouched"
  const clearFields = new Set<"phone" | "email" | "age" | "gender">();
  const setFields = new Map<"phone" | "email" | "age" | "gender", string | number>();
  for (const field of ["phone", "email", "age", "gender"] as const) {
    const value = patch[field];
    if (value === null) clearFields.add(field);
    else if (value !== undefined) setFields.set(field, value);
  }

  const mergedState = {
    name: typeof patch.name === "string" ? patch.name : current.name,
    condition: patch.condition ?? current.condition,
    doctor: patch.doctor ?? String(current.doctor),
    phone: clearFields.has("phone")
      ? undefined
      : (setFields.get("phone") ?? current.phone ?? undefined),
    email: clearFields.has("email")
      ? undefined
      : (setFields.get("email") ?? current.email ?? undefined),
    age: clearFields.has("age") ? undefined : (setFields.get("age") ?? current.age ?? undefined),
    gender: clearFields.has("gender")
      ? undefined
      : (setFields.get("gender") ?? current.gender ?? undefined),
  };

  const state = patientStateSchema.safeParse(mergedState);
  if (!state.success) {
    throw ApiError.validation(
      "The provided data is invalid.",
      state.error.issues.map((issue) => ({
        field: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    );
  }
  const next: PatientStateDto = state.data;

  // Reassignment to a different doctor — never rely on the implicit current
  // reference; the existence guarantee must hold for the NEW doctor too.
  if (next.doctor !== String(current.doctor)) {
    await assertDoctorExists(next.doctor);
  }

  // Write the exact merged state: required fields always, optionals via
  // $set or $unset (Mongoose drops `$set: undefined`, so clearing must be
  // $unset; a $unset on an already-absent field is a harmless no-op).
  const set: Record<string, unknown> = {
    name: next.name,
    condition: next.condition,
    doctor: next.doctor,
  };
  const unset: Record<string, 1> = {};
  for (const field of ["phone", "email", "age", "gender"] as const) {
    const value = next[field];
    if (value === undefined || value === null) unset[field] = 1;
    else set[field] = value;
  }

  const updated = await PatientModel.findByIdAndUpdate(
    id,
    {
      $set: set,
      ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
    },
    {
      // Deliberate: runValidators is OFF for this write. Update validators
      // evaluate this-dependent rules against a context with no document
      // (this.phone/email are undefined), which breaks the contact rule on
      // every $unset. The merged state above IS the validated truth — cross-
      // field rules at the request layer, model rules intact at create time
      // and via the patient-side doctor hook.
      returnDocument: "after",
    },
  ).lean();

  if (!updated) throw ApiError.notFound("Patient not found."); // deleted between read and write
  return toPatientSummary(updated);
}

/**
 * Hard delete (decision #5) — no soft-delete copy. The confirmation dialog is
 * a frontend concern; the API exposes exactly one honest delete verb.
 */
export async function deletePatient(id: string): Promise<void> {
  const deleted = await PatientModel.findByIdAndDelete(id);
  if (!deleted) throw ApiError.notFound("Patient not found.");
}

export async function listPatients(query: ListPatientsQuery): Promise<{
  patients: PatientSummary[];
  meta: PaginationMeta;
}> {
  const filter: Record<string, unknown> = {};

  // Free-text search across the contact/name fields, escaped and
  // case-insensitive (shared semantics with the doctors list).
  if (query.search) {
    const pattern = new RegExp(escapeRegExp(query.search), "i");
    filter.$or = (["name", "email", "phone"] as const).map((field) => ({
      [field]: pattern,
    }));
  }
  if (query.condition) filter.condition = query.condition;
  if (query.doctor) filter.doctor = query.doctor;

  const sort = buildSort(query.sort, "-createdAt", PATIENT_SORT_FIELDS);
  const skip = (query.page - 1) * query.limit;

  // Count and page read concurrently on the same connection.
  const [docs, total] = await Promise.all([
    PatientModel.find(filter, {
      // Projection discipline: only the administration-surface fields.
      name: 1,
      phone: 1,
      email: 1,
      condition: 1,
      doctor: 1,
      age: 1,
      gender: 1,
      createdAt: 1,
      updatedAt: 1,
    })
      .sort(sort)
      .skip(skip)
      .limit(query.limit)
      .lean(),
    PatientModel.countDocuments(filter),
  ]);

  return {
    patients: docs.map(toPatientSummary),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}
