import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  ApiEnvelope,
  DashboardStats,
  DoctorCreateDto,
  DoctorPatientSummary,
  DoctorSummary,
  DoctorUpdateDto,
  ListDoctorPatientsParams,
  ListDoctorsParams,
  ListPatientsParams,
  LoginCredentials,
  PaginationMeta,
  PatientCreateDto,
  PatientSummary,
  PatientUpdateDto,
  SessionData,
} from "./types";

/**
 * Query params serializer: `undefined` and `""` mean "no filter" and must not
 * reach the URL at all (the API treats an empty-string filter as absent, but
 * honest URLs keep devtools readable and cache keys stable).
 */
function listQuery(
  params: Record<string, string | number | undefined>,
): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    clean[key] = String(value);
  }
  return clean;
}

/** Lists always carry `meta` (decision #16); typed defensively for the future. */
const EMPTY_PAGINATION: PaginationMeta = { page: 1, limit: 0, total: 0, totalPages: 1 };

/** Tag constructor keeps the literal tag name from widening to `string`. */
type DoctorTagId = string | "LIST";
function doctorTag(id: DoctorTagId): { type: "Doctors"; id: DoctorTagId } {
  return { type: "Doctors", id };
}

type PatientTagId = string | "LIST";
function patientTag(id: PatientTagId): { type: "Patients"; id: PatientTagId } {
  return { type: "Patients", id };
}

/**
 * The single typed RTK Query slice (decision #7). New data surfaces
 * (patients in Step 10) register their endpoints and tags here.
 *
 * CSRF defense #3 is applied exactly once, centrally: every mutation carries
 * the `X-Requested-With` marker the API's gate pairs with the SameSite cookie
 * + Origin allowlist (decisions #10/#14).
 *
 * Tag layout: `LIST` sentinel + one `Doctors` tag per record id — reads
 * provide, writes invalidate, so no page can silently go stale.
 */
export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    // Same-origin always: next.config.ts proxies /api/* to the API process,
    // so cookies are first-party and no CORS surface exists.
    baseUrl: "/api",
    credentials: "same-origin",
    prepareHeaders: (headers, { type }) => {
      if (type === "mutation") headers.set("X-Requested-With", "XMLHttpRequest");
      return headers;
    },
  }),
  tagTypes: ["Session", "Doctors", "Patients"],
  endpoints: (builder) => ({
    /* ---- Session ------------------------------------------------------- */
    me: builder.query<SessionData, void>({
      query: () => "auth/me",
      transformResponse: (raw: ApiEnvelope<SessionData>) => raw.data,
      providesTags: ["Session"],
    }),
    login: builder.mutation<SessionData, LoginCredentials>({
      query: (credentials) => ({ url: "auth/login", method: "POST", body: credentials }),
      transformResponse: (raw: ApiEnvelope<SessionData>) => raw.data,
      invalidatesTags: ["Session"],
    }),
    logout: builder.mutation<{ loggedOut: boolean }, void>({
      query: () => ({ url: "auth/logout", method: "POST" }),
      transformResponse: (raw: ApiEnvelope<{ loggedOut: boolean }>) => raw.data,
      invalidatesTags: ["Session"],
      // Cache hygiene lives on the endpoint lifecycle (the docs' logout
      // pattern): the ENTIRE RTK cache is dropped, not just the Session tag —
      // protected doctor/patient data must not outlive the session in Redux
      // memory. Components only navigate home.
      onQueryStarted: async (_arg, { queryFulfilled, dispatch }) => {
        await queryFulfilled;
        dispatch(api.util.resetApiState());
      },
    }),

    /* ---- Doctors (Steps 9+) -------------------------------------------- */
    getDoctors: builder.query<{ doctors: DoctorSummary[]; meta: PaginationMeta }, ListDoctorsParams>({
      query: (params) => ({ url: "doctors", params: listQuery(params) }),
      transformResponse: (raw: ApiEnvelope<{ doctors: DoctorSummary[] }>) => ({
        doctors: raw.data.doctors,
        meta: raw.meta ?? EMPTY_PAGINATION,
      }),
      providesTags: (result) =>
        result && result.doctors.length > 0
          ? [doctorTag("LIST"), ...result.doctors.map((doctor) => doctorTag(doctor.id))]
          : [doctorTag("LIST")],
    }),
    getDoctor: builder.query<DoctorSummary, string>({
      query: (id) => `doctors/${id}`,
      transformResponse: (raw: ApiEnvelope<{ doctor: DoctorSummary }>) => raw.data.doctor,
      providesTags: (_result, _error, id) => [doctorTag(id)],
    }),
    getDoctorPatients: builder.query<
      { patients: DoctorPatientSummary[]; meta: PaginationMeta },
      { id: string; params: ListDoctorPatientsParams }
    >({
      query: ({ id, params }) => ({ url: `doctors/${id}/patients`, params: listQuery(params) }),
      transformResponse: (raw: ApiEnvelope<{ patients: DoctorPatientSummary[] }>) => ({
        patients: raw.data.patients,
        meta: raw.meta ?? EMPTY_PAGINATION,
      }),
      providesTags: (_result, _error, { id }) => [doctorTag(id)],
    }),
    createDoctor: builder.mutation<DoctorSummary, DoctorCreateDto>({
      query: (dto) => ({ url: "doctors", method: "POST", body: dto }),
      transformResponse: (raw: ApiEnvelope<{ doctor: DoctorSummary }>) => raw.data.doctor,
      invalidatesTags: [doctorTag("LIST")],
    }),
    updateDoctor: builder.mutation<DoctorSummary, { id: string; patch: DoctorUpdateDto }>({
      query: ({ id, patch }) => ({ url: `doctors/${id}`, method: "PATCH", body: patch }),
      transformResponse: (raw: ApiEnvelope<{ doctor: DoctorSummary }>) => raw.data.doctor,
      invalidatesTags: (_result, _error, { id }) => [doctorTag(id), doctorTag("LIST")],
    }),
    deleteDoctor: builder.mutation<boolean, string>({
      query: (id) => ({ url: `doctors/${id}`, method: "DELETE" }),
      transformResponse: (raw: ApiEnvelope<{ deleted: boolean }>) => raw.data.deleted,
      invalidatesTags: (_result, _error, id) => [doctorTag("LIST"), doctorTag(id)],
    }),

    /* ---- Patients (Step 10, decision #17 semantics) --------------------- */
    getPatients: builder.query<{ patients: PatientSummary[]; meta: PaginationMeta }, ListPatientsParams>({
      query: (params) => ({ url: "patients", params: listQuery(params) }),
      transformResponse: (raw: ApiEnvelope<{ patients: PatientSummary[] }>) => ({
        patients: raw.data.patients,
        meta: raw.meta ?? EMPTY_PAGINATION,
      }),
      providesTags: (result) =>
        result && result.patients.length > 0
          ? [patientTag("LIST"), ...result.patients.map((patient) => patientTag(patient.id))]
          : [patientTag("LIST")],
    }),
    getPatient: builder.query<PatientSummary, string>({
      query: (id) => `patients/${id}`,
      transformResponse: (raw: ApiEnvelope<{ patient: PatientSummary }>) => raw.data.patient,
      providesTags: (_result, _error, id) => [patientTag(id)],
    }),
    createPatient: builder.mutation<PatientSummary, PatientCreateDto>({
      query: (dto) => ({ url: "patients", method: "POST", body: dto }),
      transformResponse: (raw: ApiEnvelope<{ patient: PatientSummary }>) => raw.data.patient,
      // The assigned doctor's patient pages (search + counts) must refetch.
      invalidatesTags: (_result, _error, dto) => [patientTag("LIST"), doctorTag(dto.doctor)],
    }),
    updatePatient: builder.mutation<
      PatientSummary,
      { id: string; patch: PatientUpdateDto; currentDoctorId: string }
    >({
      query: ({ id, patch }) => ({ url: `patients/${id}`, method: "PATCH", body: patch }),
      transformResponse: (raw: ApiEnvelope<{ patient: PatientSummary }>) => raw.data.patient,
      invalidatesTags: (_result, _error, { id, patch, currentDoctorId }) => {
        const tags = [patientTag("LIST"), patientTag(id), doctorTag(currentDoctorId)];
        // A reassignment also refreshes the NEW doctor's patient pages.
        if (patch.doctor !== undefined && patch.doctor !== currentDoctorId) {
          tags.push(doctorTag(patch.doctor));
        }
        return tags;
      },
    }),
    deletePatient: builder.mutation<boolean, { id: string; doctorId: string }>({
      query: ({ id }) => ({ url: `patients/${id}`, method: "DELETE" }),
      transformResponse: (raw: ApiEnvelope<{ deleted: boolean }>) => raw.data.deleted,
      invalidatesTags: (_result, _error, { id, doctorId }) => [
        patientTag("LIST"),
        patientTag(id),
        doctorTag(doctorId), // the ex-doctor's patient page/count refresh
      ],
    }),

    /* ---- Dashboard (Step 11) ------------------------------------------- */
    getDashboardStats: builder.query<DashboardStats, void>({
      query: () => "dashboard",
      transformResponse: (raw: ApiEnvelope<{ stats: DashboardStats }>) =>
        raw.data.stats,
    }),
  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useMeQuery,
  useGetDoctorsQuery,
  useGetDoctorQuery,
  useGetDoctorPatientsQuery,
  useCreateDoctorMutation,
  useUpdateDoctorMutation,
  useDeleteDoctorMutation,
  useGetPatientsQuery,
  useGetPatientQuery,
  useCreatePatientMutation,
  useUpdatePatientMutation,
  useDeletePatientMutation,
  useGetDashboardStatsQuery,
} = api;
