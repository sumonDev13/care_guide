"use client";

import type { FieldErrors } from "@/lib/api/api-errors";
import type { PatientCreateDto } from "@/lib/api/types";
import { PATIENT_CONDITIONS, PATIENT_GENDERS } from "@/lib/api/types";

/**
 * Patient record form for CREATE. The API validates (contact rule, doctor
 * existence, enum membership); forms render its 422 details verbatim
 * (API-first validation, decision #19's pattern).
 */
export function PatientFormFields({
  values,
  onChange,
  doctorOptions,
  errors,
  disabled,
}: {
  values: PatientCreateDto;
  onChange: (next: PatientCreateDto) => void;
  /** Doctor directory for the assignment select. */
  doctorOptions: Array<{ id: string; name: string }>;
  errors: FieldErrors;
  disabled: boolean;
}) {
  return (
    <>
      <label className="field span2">
        <span>Patient name</span>
        <input
          type="text"
          maxLength={120}
          autoComplete="off"
          placeholder="Nabila Siddique"
          value={values.name}
          onChange={(event) => onChange({ ...values, name: event.target.value })}
          disabled={disabled}
        />
        {errors.name && <em className="fieldError">{errors.name}</em>}
      </label>

      <label className="field">
        <span>Condition category</span>
        <select
          value={values.condition}
          onChange={(event) => onChange({ ...values, condition: event.target.value })}
          disabled={disabled}
        >
          <option value="">Select condition…</option>
          {PATIENT_CONDITIONS.map((item) => (
            <option key={item} value={item}>
              {item[0]?.toUpperCase() + item.slice(1)}
            </option>
          ))}
        </select>
        {errors.condition && <em className="fieldError">{errors.condition}</em>}
      </label>

      <label className="field">
        <span>Assigned doctor</span>
        <select
          value={values.doctor}
          onChange={(event) => onChange({ ...values, doctor: event.target.value })}
          disabled={disabled}
        >
          <option value="">Select doctor…</option>
          {doctorOptions.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>
              {doctor.name}
            </option>
          ))}
        </select>
        {errors.doctor && <em className="fieldError">{errors.doctor}</em>}
      </label>

      <label className="field">
        <span>Phone</span>
        <input
          type="tel"
          autoComplete="off"
          placeholder="+880 1900 000 000"
          value={values.phone ?? ""}
          onChange={(event) => onChange({ ...values, phone: event.target.value })}
          disabled={disabled}
        />
        {errors.phone && <em className="fieldError">{errors.phone}</em>}
      </label>

      <label className="field">
        <span>Email</span>
        <input
          type="email"
          autoComplete="off"
          placeholder="patient@mail.example"
          value={values.email ?? ""}
          onChange={(event) => onChange({ ...values, email: event.target.value })}
          disabled={disabled}
        />
        {errors.email && <em className="fieldError">{errors.email}</em>}
      </label>

      <label className="field">
        <span>Age</span>
        <input
          type="number"
          min={0}
          max={130}
          inputMode="numeric"
          value={values.age ?? ""}
          onChange={(event) => onChange({ ...values, age: event.target.value === "" ? undefined : Number(event.target.value) })}
          disabled={disabled}
        />
        {errors.age && <em className="fieldError">{errors.age}</em>}
      </label>

      <label className="field">
        <span>Gender</span>
        <select
          value={values.gender ?? ""}
          onChange={(event) => onChange({ ...values, gender: event.target.value === "" ? undefined : event.target.value })}
          disabled={disabled}
        >
          <option value="">Not specified</option>
          {PATIENT_GENDERS.map((item) => (
            <option key={item} value={item}>
              {item[0]?.toUpperCase() + item.slice(1)}
            </option>
          ))}
        </select>
        {errors.gender && <em className="fieldError">{errors.gender}</em>}
      </label>

      <p className="hint span2">
        At least one contact channel (phone or email) is required.
      </p>
    </>
  );
}
