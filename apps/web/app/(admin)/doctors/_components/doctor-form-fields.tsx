"use client";

import type { DoctorCreateDto } from "@/lib/api/types";
import type { FieldErrors } from "@/lib/api/api-errors";

/**
 * The doctor record form (create + edit share it). No client-side rule
 * duplicates: the API validates and returns field details — forms render
 * them verbatim under the inputs (API-first validation).
 */
export function DoctorFormFields({
  values,
  onChange,
  errors,
  disabled,
}: {
  values: DoctorCreateDto;
  onChange: (next: DoctorCreateDto) => void;
  errors: FieldErrors;
  disabled: boolean;
}) {
  function field(input: keyof DoctorCreateDto) {
    return {
      value: values[input],
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        onChange({ ...values, [input]: event.target.value }),
      disabled,
    };
  }

  return (
    <>
      <label className="field span2">
        <span>Full name</span>
        <input type="text" maxLength={120} autoComplete="off" placeholder="Dr. Ayesha Rahman" {...field("name")} />
        {errors.name && <em className="fieldError">{errors.name}</em>}
      </label>

      <label className="field">
        <span>Specialization</span>
        <input type="text" maxLength={80} autoComplete="off" placeholder="Pediatrics" {...field("specialization")} />
        {errors.specialization && <em className="fieldError">{errors.specialization}</em>}
      </label>

      <label className="field">
        <span>Hospital</span>
        <input type="text" maxLength={200} autoComplete="off" placeholder="Dhaka General Hospital" {...field("hospital")} />
        {errors.hospital && <em className="fieldError">{errors.hospital}</em>}
      </label>

      <label className="field">
        <span>Phone</span>
        <input type="tel" autoComplete="off" placeholder="+880 1700 000 000" {...field("phone")} />
        {errors.phone && <em className="fieldError">{errors.phone}</em>}
      </label>

      <label className="field">
        <span>Email</span>
        <input type="email" autoComplete="off" placeholder="ayesha.rahman@hospital.example" {...field("email")} />
        {errors.email && <em className="fieldError">{errors.email}</em>}
      </label>
    </>
  );
}
