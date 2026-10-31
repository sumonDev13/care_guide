"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  useGetDoctorsQuery,
  useGetPatientQuery,
  useUpdatePatientMutation,
} from "@/lib/api/api";
import type { PatientUpdateDto } from "@/lib/api/types";
import { failureMessage, fieldErrors, type FieldErrors } from "@/lib/api/api-errors";
import { PATIENT_CONDITIONS, PATIENT_GENDERS } from "@/lib/api/types";

/**
 * Edit form with decision #17's exact write semantics:
 *   value present        → "set"
 *   Clear toggle checked → JSON null ("clear", API $unset)
 *   field left empty     → key omitted ("leave untouched")
 */
export default function EditPatientPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const patientId = params.id;

  const patient = useGetPatientQuery(patientId);
  const doctorsQuery = useGetDoctorsQuery({ limit: 100, sort: "name" });
  const doctorDirectory = doctorsQuery.data?.doctors ?? [];

  const [updatePatient, { isLoading: saving }] = useUpdatePatientMutation();

  type PatientDraft = {
    name: string;
    condition: string;
    doctor: string;
    phone: string;
    email: string;
    age: string;
    gender: string;
  };
  const [values, setValues] = useState<PatientDraft | null>(null);
  const [clear, setClear] = useState({ phone: false, email: false, age: false });
  const [fieldErrorsState, setFieldErrorsState] = useState<FieldErrors | null>(null);
  const [alert, setAlert] = useState<string | null>(null);

  // Prefill from the canonical server state when the read settles.
  useEffect(() => {
    if (patient.data && values === null) {
      setValues({
        name: patient.data.name,
        condition: patient.data.condition,
        doctor: patient.data.doctorId,
        phone: patient.data.phone ?? "",
        email: patient.data.email ?? "",
        age: patient.data.age === undefined ? "" : String(patient.data.age),
        gender: patient.data.gender ?? "",
      });
    }
  }, [patient.data, values]);

  const data = patient.data; // const capture — narrows inside JSX + callbacks

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (values === null || data === undefined) return;

    setAlert(null);
    setFieldErrorsState(null);

    // Encoding guard only (not a duplicate business rule): a non-numeric age
    // must not serialize as NaN → JSON null (which would wrongly CLEAR it).
    let ageValue: number | null | undefined;
    if (clear.age) {
      ageValue = null;
    } else if (values.age.trim() !== "") {
      const parsed = Number(values.age);
      if (!Number.isFinite(parsed)) {
        setFieldErrorsState({ age: "Enter a numeric age (years)" });
        return;
      }
      ageValue = parsed;
    }

    const patch: PatientUpdateDto = {
      name: values.name,
      condition: values.condition,
      doctor: values.doctor,
      phone: clear.phone ? null : (values.phone.trim() || undefined),
      email: clear.email ? null : (values.email.trim() || undefined),
      age: ageValue,
      gender: values.gender === "__clear__" ? null : (values.gender || undefined),
    };

    try {
      await updatePatient({ id: patientId, patch, currentDoctorId: data.doctorId }).unwrap();
      router.push(`/patients/${patientId}`);
    } catch (failure) {
      setFieldErrorsState(fieldErrors(failure));
      setAlert(failureMessage(failure));
    }
  }

  function clearToggle(key: "phone" | "email" | "age") {
    setClear({ ...clear, [key]: !clear[key] });
  }

  return (
    <section>
      <Link className="backLink" href={`/patients/${patientId}`}>
        ← Back to patient
      </Link>
      <div className="pageHead">
        <h1>Edit patient</h1>
      </div>

      <div className="formCard">
        {patient.isLoading ? (
          <p className="emptyState">Loading patient…</p>
        ) : patient.error ? (
          <p className="alert" role="alert">
            {failureMessage(patient.error)}
          </p>
        ) : values === null || data === undefined ? (
          <p className="emptyState">Preparing form…</p>
        ) : (
          <>
            {alert && (
              <p className="alert" role="alert">
                {alert}
              </p>
            )}
            <form onSubmit={handleSubmit} noValidate>
              <div className="formGrid">
                <label className="field span2">
                  <span>Patient name</span>
                  <input
                    type="text"
                    maxLength={120}
                    value={values.name}
                    onChange={(event) => setValues({ ...values, name: event.target.value })}
                    disabled={saving}
                  />
                  {fieldErrorsState?.name && <em className="fieldError">{fieldErrorsState.name}</em>}
                </label>

                <label className="field">
                  <span>Condition category</span>
                  <select
                    value={values.condition}
                    onChange={(event) => setValues({ ...values, condition: event.target.value })}
                    disabled={saving}
                  >
                    {PATIENT_CONDITIONS.map((item) => (
                      <option key={item} value={item}>
                        {item[0]?.toUpperCase() + item.slice(1)}
                      </option>
                    ))}
                  </select>
                  {fieldErrorsState?.condition && (
                    <em className="fieldError">{fieldErrorsState.condition}</em>
                  )}
                </label>

                <label className="field">
                  <span>Assigned doctor</span>
                  <select
                    value={values.doctor}
                    onChange={(event) => setValues({ ...values, doctor: event.target.value })}
                    disabled={saving}
                  >
                    {!doctorDirectory.some((doctor) => doctor.id === data.doctorId) && (
                      <option value={data.doctorId}>Current doctor</option>
                    )}
                    {doctorDirectory.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.id === data.doctorId ? `${doctor.name} (current)` : doctor.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrorsState?.doctor && <em className="fieldError">{fieldErrorsState.doctor}</em>}
                </label>

                <label className="field">
                  <span>
                    Phone
                    <span className="clearToggle">
                      <input
                        type="checkbox"
                        checked={clear.phone}
                        onChange={() => clearToggle("phone")}
                        disabled={saving}
                      />
                      Clear
                    </span>
                  </span>
                  <input
                    type="tel"
                    autoComplete="off"
                    value={clear.phone ? "" : values.phone}
                    onChange={(event) => setValues({ ...values, phone: event.target.value })}
                    disabled={saving || clear.phone}
                  />
                  {fieldErrorsState?.phone && <em className="fieldError">{fieldErrorsState.phone}</em>}
                </label>

                <label className="field">
                  <span>
                    Email
                    <span className="clearToggle">
                      <input
                        type="checkbox"
                        checked={clear.email}
                        onChange={() => clearToggle("email")}
                        disabled={saving}
                      />
                      Clear
                    </span>
                  </span>
                  <input
                    type="email"
                    autoComplete="off"
                    value={clear.email ? "" : values.email}
                    onChange={(event) => setValues({ ...values, email: event.target.value })}
                    disabled={saving || clear.email}
                  />
                  {fieldErrorsState?.email && <em className="fieldError">{fieldErrorsState.email}</em>}
                </label>

                <label className="field">
                  <span>
                    Age
                    <span className="clearToggle">
                      <input
                        type="checkbox"
                        checked={clear.age}
                        onChange={() => clearToggle("age")}
                        disabled={saving}
                      />
                      Clear
                    </span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={130}
                    inputMode="numeric"
                    value={clear.age ? "" : values.age}
                    onChange={(event) => setValues({ ...values, age: event.target.value })}
                    disabled={saving || clear.age}
                  />
                  {fieldErrorsState?.age && <em className="fieldError">{fieldErrorsState.age}</em>}
                </label>

                <label className="field">
                  <span>Gender</span>
                  <select
                    value={values.gender}
                    onChange={(event) => setValues({ ...values, gender: event.target.value })}
                    disabled={saving}
                  >
                    <option value="">(leave as is)</option>
                    <option value="__clear__">Clear value</option>
                    {PATIENT_GENDERS.map((item) => (
                      <option key={item} value={item}>
                        {item[0]?.toUpperCase() + item.slice(1)}
                      </option>
                    ))}
                  </select>
                  {fieldErrorsState?.gender && <em className="fieldError">{fieldErrorsState.gender}</em>}
                </label>

                <p className="hint span2">
                  At least one contact channel (phone or email) must remain —
                  the API validates the whole record after every edit.
                </p>
              </div>
              <button className="button" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
