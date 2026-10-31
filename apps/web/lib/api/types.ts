/**
 * Wire mirrors of the API's response envelope and payload shapes
 * (apps/api/src/services/doctors.service.ts, auth.controller.ts). Endpoint
 * slices transform the envelope away, so hooks receive the `data` payload
 * directly.
 */

/** Pagination footer `meta` for every list surface (decision #16). */
export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/** Every success reply: `{ success: true, data: T, meta? }`. */
export type ApiEnvelope<T> = {
  success: true;
  data: T;
  meta?: PaginationMeta;
};

/** Session payload — admin identity only; never carries credential material. */
export type AdminSummary = {
  id: string;
  name: string;
  email: string;
};

export type SessionData = {
  admin: AdminSummary;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

/** The documented error half: `{ success: false, error: { code, message } }`. */
export type ApiErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
};

/* ---- Doctors (decision #16 list conventions) ----------------------------- */

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

export type DoctorCreateDto = {
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
};

/** PATCH — any subset; the API re-validates the full merged state. */
export type DoctorUpdateDto = Partial<DoctorCreateDto>;

export type ListDoctorsParams = {
  search?: string;
  specialization?: string;
  hospital?: string;
  /** `-prefix` = descending; default `-createdAt`. Whitelisted API-side. */
  sort?: string;
  page?: number;
  limit?: number;
};

/** Coarse patient condition categories — mirrored from the patient model. */
export const PATIENT_CONDITIONS = [
  "general",
  "chronic",
  "injury",
  "preventive",
  "pediatric",
  "other",
] as const;

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

export type ListDoctorPatientsParams = {
  condition?: string;
  sort?: string;
  page?: number;
  limit?: number;
};

/* ---- Patients (decision #17 semantics) ----------------------------------- */

export type PatientSummary = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  condition: string;
  /** Assigned doctor as a bare id — names are joined client-side. */
  doctorId: string;
  age?: number;
  gender?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PatientCreateDto = {
  name: string;
  condition: string;
  /** 24-character doctor ObjectId. */
  doctor: string;
  phone?: string;
  email?: string;
  age?: number;
  gender?: string;
};

/**
 * PATCH — any subset; `null` explicitly clears an optional field
 * (implemented API-side via $unset, decision #17), an absent key leaves the
 * stored value untouched (JSON.stringify drops undefined).
 */
export type PatientUpdateDto = {
  name?: string;
  condition?: string;
  doctor?: string;
  phone?: string | null;
  email?: string | null;
  age?: number | null;
  gender?: string | null;
};

export type ListPatientsParams = {
  search?: string;
  condition?: string;
  /** Filter by assigned doctor's ObjectId. */
  doctor?: string;
  sort?: string;
  page?: number;
  limit?: number;
};

/** Optional demographics — mirrored from the patient model. */
export const PATIENT_GENDERS = ["male", "female", "other"] as const;
