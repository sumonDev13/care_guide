import { DoctorModel, type DoctorDoc } from "../models/doctor.model.js";
import { PatientModel } from "../models/patient.model.js";
import { ApiError } from "../utils/errors.js";
import type {
  CreateDoctorDto,
  ListDoctorPatientsQuery,
  ListDoctorsQuery,
  UpdateDoctorDto,
} from "../validators/doctors.validators.js";

const MONGO_DUPLICATE_KEY = 11000;

/**
 * Wire summaries — the exact field set every doctors endpoint returns.
 * ObjectIds and Dates are normalized to strings here so transport and the
 * frontend never deal with Mongo types (and hashes/secrets can never exist
 * on this surface by construction).
 */
export type DoctorSummary = {
  id: string;
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
};

type LeanDoctor = Omit<DoctorDoc, "_id"> & { _id: unknown };

function toDoctorSummary(doc: LeanDoctor): DoctorSummary {
  return {
    id: String(doc._id),
    name: doc.name,
    specialization: doc.specialization,
    hospital: doc.hospital,
    phone: doc.phone,
    email: doc.email,
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
  };
}

export type DoctorPatientSummary = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  condition: string;
  age?: number;
  gender?: string;
  createdAt?: string;
  updatedAt?: string;
};

type LeanPatient = {
  _id: unknown;
  name: string;
  phone?: string;
  email?: string;
  condition: string;
  age?: number;
  gender?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

function toPatientSummary(doc: LeanPatient): DoctorPatientSummary {
  return {
    id: String(doc._id),
    name: doc.name,
    phone: doc.phone,
    email: doc.email,
    condition: doc.condition,
    age: doc.age,
    gender: doc.gender,
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
  };
}

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  // An empty list still reports one logical page — totalPages is never zero
  // so paginated UIs can always render "page 1 of 1".
  return { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) };
}

/** E11000 (unique-index violation) is the business rule "email already taken". */
function conflictIfDuplicateEmail(error: unknown): void {
  if (error instanceof Error && (error as { code?: unknown }).code === MONGO_DUPLICATE_KEY) {
    throw ApiError.conflict("A doctor with this email address already exists.");
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Exact match ignoring case — user-typed casing must not matter. */
function anchoredCaseInsensitive(text: string): { $regex: string; $options: string } {
  return { $regex: `^${escapeRegExp(text)}$`, $options: "i" };
}

export async function createDoctor(dto: CreateDoctorDto): Promise<DoctorSummary> {
  // Email is lowercased here (not via schema setters) so uniqueness-conflict
  // detection is deterministic on every write path.
  try {
    const created = await DoctorModel.create({ ...dto, email: dto.email.toLowerCase() });
    return toDoctorSummary(created);
  } catch (error) {
    conflictIfDuplicateEmail(error);
    throw error;
  }
}

export async function getDoctor(id: string): Promise<DoctorSummary> {
  const doc = await DoctorModel.findById(id).lean();
  if (!doc) throw ApiError.notFound("Doctor not found.");
  return toDoctorSummary(doc);
}

export async function updateDoctor(id: string, patch: UpdateDoctorDto): Promise<DoctorSummary> {
  const update: Record<string, string> = { ...patch };
  if (typeof update.email === "string") update.email = update.email.toLowerCase();

  try {
    const updated = await DoctorModel.findByIdAndUpdate(id, update, {
      returnDocument: "after", // return the edited document, not the pre-edit one
      runValidators: true, // model rules apply to edits too, not just creation
    }).lean();
    if (!updated) throw ApiError.notFound("Doctor not found.");
    return toDoctorSummary(updated);
  } catch (error) {
    conflictIfDuplicateEmail(error);
    throw error;
  }
}

const DOCTOR_SORT_FIELDS = ["name", "specialization", "hospital", "createdAt"] as const;
const PATIENT_SORT_FIELDS = ["name", "createdAt"] as const;

/** Sort parse shared by both lists: `-prefix` = descending, else ascending. */
function buildSort(
  rawSort: string | undefined,
  defaultSort: string,
  allowedFields: readonly string[],
): Record<string, 1 | -1> {
  const raw = rawSort ?? defaultSort;
  const descending = raw.startsWith("-");
  const field = descending ? raw.slice(1) : raw;

  // Redundant with validator whitelisting; keeps the service safe for any
  // future caller that skips the request layer.
  const allowed = allowedFields.includes(field) ? field : defaultSort.replace(/^-/, "");

  return { [allowed]: descending ? -1 : 1 };
}

export async function listDoctors(query: ListDoctorsQuery): Promise<{
  doctors: DoctorSummary[];
  meta: PaginationMeta;
}> {
  const filter: Record<string, unknown> = {};

  // Free-text search across all identity-ish fields, case-insensitive,
  // escaped (a user typing "Dr. (Who)" must not be interpreted as regex).
  if (query.search) {
    const pattern = new RegExp(escapeRegExp(query.search), "i");
    filter.$or = (["name", "email", "phone", "hospital"] as const).map((field) => ({
      [field]: pattern,
    }));
  }
  if (query.specialization) {
    filter.specialization = anchoredCaseInsensitive(query.specialization);
  }
  if (query.hospital) {
    filter.hospital = anchoredCaseInsensitive(query.hospital);
  }

  const sort = buildSort(query.sort, "-createdAt", DOCTOR_SORT_FIELDS);
  const skip = (query.page - 1) * query.limit;

  // Count and page read concurrently on the same connection — no extra
  // round-trip sequencing for Atlas latency.
  const [docs, total] = await Promise.all([
    DoctorModel.find(filter).sort(sort).skip(skip).limit(query.limit).lean(),
    DoctorModel.countDocuments(filter),
  ]);

  return {
    doctors: docs.map(toDoctorSummary),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function listDoctorPatients(
  id: string,
  query: ListDoctorPatientsQuery,
): Promise<{
  patients: DoctorPatientSummary[];
  meta: PaginationMeta;
}> {
  // 404 first: "this doctor does not exist" must not coalesce into a
  // silently empty patient page.
  const doctorExists = await DoctorModel.exists({ _id: id });
  if (!doctorExists) throw ApiError.notFound("Doctor not found.");

  const filter: Record<string, unknown> = { doctor: id };
  if (query.condition) filter.condition = query.condition;

  const sort = buildSort(query.sort, "-createdAt", PATIENT_SORT_FIELDS);
  const skip = (query.page - 1) * query.limit;

  const [docs, total] = await Promise.all([
    PatientModel.find(filter, {
      // Projection discipline: only the administration-surface fields.
      name: 1,
      phone: 1,
      email: 1,
      condition: 1,
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
