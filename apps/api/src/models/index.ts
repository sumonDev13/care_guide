/**
 * Model registry — the single import surface for all data access so
 * registration order is deterministic even when the bundler/CTS reorders.
 *
 * Currently: Doctor (base) → Patient (references Doctor's model name).
 * Admin model joins here in the auth step (Step 5).
 */
export { DoctorModel, type DoctorDoc } from "./doctor.model.js";
export { PatientModel, PATIENT_CONDITIONS, PATIENT_GENDERS, type PatientCondition, type PatientDoc, type PatientGender } from "./patient.model.js";
