/**
 * Model registry — the single import surface for all data access so
 * registration order is deterministic even when the bundler/CTS reorders.
 *
 * Doctor (base) → Patient (references Doctor's model name) — plus
 * Admin and Session for the authentication layer.
 */
export { AdminModel, type AdminDoc } from "./admin.model.js";
export { SessionModel, type SessionDoc } from "./session.model.js";
export { DoctorModel, type DoctorDoc } from "./doctor.model.js";
export { PatientModel, PATIENT_CONDITIONS, PATIENT_GENDERS, type PatientCondition, type PatientDoc, type PatientGender } from "./patient.model.js";
