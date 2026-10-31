"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useGetDoctorQuery, useUpdateDoctorMutation } from "@/lib/api/api";
import type { DoctorCreateDto } from "@/lib/api/types";
import { failureMessage, fieldErrors, type FieldErrors } from "@/lib/api/api-errors";
import { DoctorFormFields } from "../../_components/doctor-form-fields";

export default function EditDoctorPage() {
  const router = useRouter();
  // useParams is a plain object at runtime; safe parse via useParams<{id}>()
  const params = useParams<{ id: string }>();
  const doctorId = params.id;

  const doctor = useGetDoctorQuery(doctorId);
  const [updateDoctor, { isLoading: saving }] = useUpdateDoctorMutation();

  const [values, setValues] = useState<DoctorCreateDto | null>(null);
  const [fieldErrorsState, setFieldErrorsState] = useState<FieldErrors>({});
  const [alert, setAlert] = useState<string | null>(null);

  // Prefill from the canonical server state when the read settles.
  useEffect(() => {
    if (doctor.data && values === null) {
      const { name, specialization, hospital, phone, email } = doctor.data;
      setValues({ name, specialization, hospital, phone, email });
    }
  }, [doctor.data, values]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (values === null) return;
    setAlert(null);
    setFieldErrorsState({});
    try {
      // The API re-validates the full merged state; sending every field is
      // simply the most explicit patch.
      await updateDoctor({ id: doctorId, patch: values }).unwrap();
      router.push(`/doctors/${doctorId}`);
    } catch (failure) {
      setFieldErrorsState(fieldErrors(failure));
      setAlert(failureMessage(failure));
    }
  }

  return (
    <section>
      <Link className="backLink" href={`/doctors/${doctorId}`}>
        ← Back to doctor
      </Link>
      <div className="pageHead">
        <h1>Edit doctor</h1>
      </div>

      <div className="formCard">
        {doctor.isLoading ? (
          <p className="emptyState">Loading doctor…</p>
        ) : doctor.error ? (
          <p className="alert" role="alert">
            {failureMessage(doctor.error)}
          </p>
        ) : values === null ? (
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
                <DoctorFormFields values={values} onChange={setValues} errors={fieldErrorsState} disabled={saving} />
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
