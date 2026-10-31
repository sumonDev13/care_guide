"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { useCreatePatientMutation, useGetDoctorsQuery } from "@/lib/api/api";
import type { PatientCreateDto } from "@/lib/api/types";
import { failureMessage, fieldErrors, type FieldErrors } from "@/lib/api/api-errors";
import { PatientFormFields } from "../_components/patient-form-fields";

const BLANK_PATIENT: PatientCreateDto = {
  name: "",
  condition: "",
  doctor: "",
  phone: "",
  email: "",
  age: undefined,
  gender: undefined,
};

export default function NewPatientPage() {
  const router = useRouter();
  const [createPatient, { isLoading: creating }] = useCreatePatientMutation();
  const doctorsQuery = useGetDoctorsQuery({ limit: 100, sort: "name" });

  const doctorOptions = useMemo(
    () => (doctorsQuery.data?.doctors ?? []).map((doctor) => ({ id: doctor.id, name: doctor.name })),
    [doctorsQuery.data],
  );

  const [values, setValues] = useState<PatientCreateDto>(BLANK_PATIENT);
  const [fieldErrorsState, setFieldErrorsState] = useState<FieldErrors>({});
  const [alert, setAlert] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAlert(null);
    setFieldErrorsState({});
    try {
      const patient = await createPatient({
        ...values,
        // Empty optionals mean "absent", not "" — undefined keys never send.
        phone: values.phone?.trim() || undefined,
        email: values.email?.trim() || undefined,
      }).unwrap();
      router.push(`/patients/${patient.id}`);
    } catch (failure) {
      setFieldErrorsState(fieldErrors(failure));
      setAlert(failureMessage(failure));
    }
  }

  return (
    <section>
      <Link className="backLink" href="/patients">
        ← Back to patients
      </Link>
      <div className="pageHead">
        <h1>Add patient</h1>
      </div>

      <div className="formCard">
        {doctorsQuery.isLoading && <p className="emptyState">Loading doctors…</p>}
        {doctorsQuery.error && (
          <p className="alert" role="alert">
            {failureMessage(doctorsQuery.error)}
          </p>
        )}
        {alert && (
          <p className="alert" role="alert">
            {alert}
          </p>
        )}
        <form onSubmit={handleSubmit} noValidate>
          <div className="formGrid">
            <PatientFormFields
              values={values}
              onChange={setValues}
              doctorOptions={doctorOptions}
              errors={fieldErrorsState}
              disabled={creating || doctorsQuery.isLoading}
            />
          </div>
          <button
            className="button"
            type="submit"
            disabled={creating || doctorsQuery.isLoading}
          >
            {creating ? "Saving…" : "Create patient"}
          </button>
        </form>
      </div>
    </section>
  );
}
