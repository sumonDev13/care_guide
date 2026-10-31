"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useCreateDoctorMutation } from "@/lib/api/api";
import type { DoctorCreateDto } from "@/lib/api/types";
import { failureMessage, fieldErrors, type FieldErrors } from "@/lib/api/api-errors";
import { DoctorFormFields } from "../_components/doctor-form-fields";

const BLANK_DOCTOR: DoctorCreateDto = {
  name: "",
  specialization: "",
  hospital: "",
  phone: "",
  email: "",
};

export default function NewDoctorPage() {
  const router = useRouter();
  const [createDoctor, { isLoading: creating }] = useCreateDoctorMutation();

  const [values, setValues] = useState<DoctorCreateDto>(BLANK_DOCTOR);
  const [fieldErrorsState, setFieldErrorsState] = useState<FieldErrors>({});
  const [alert, setAlert] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAlert(null);
    setFieldErrorsState({});
    try {
      const doctor = await createDoctor(values).unwrap();
      router.push(`/doctors/${doctor.id}`);
    } catch (failure) {
      setFieldErrorsState(fieldErrors(failure));
      setAlert(failureMessage(failure));
    }
  }

  return (
    <section>
      <Link className="backLink" href="/doctors">
        ← Back to doctors
      </Link>
      <div className="pageHead">
        <h1>Add doctor</h1>
      </div>

      <div className="formCard">
        {alert && (
          <p className="alert" role="alert">
            {alert}
          </p>
        )}
        <form onSubmit={handleSubmit} noValidate>
          <div className="formGrid">
            <DoctorFormFields values={values} onChange={setValues} errors={fieldErrorsState} disabled={creating} />
          </div>
          <button className="button" type="submit" disabled={creating}>
            {creating ? "Saving…" : "Create doctor"}
          </button>
        </form>
      </div>
    </section>
  );
}
