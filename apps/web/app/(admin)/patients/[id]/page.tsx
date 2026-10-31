"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  useGetDoctorQuery,
  useGetPatientQuery,
} from "@/lib/api/api";
import { failureMessage } from "@/lib/api/api-errors";
import { formatDateTime } from "@/lib/ui/format";
import { ConfirmPatientDelete } from "../_components/confirm-patient-delete";

export default function PatientDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const patientId = params.id;

  const patient = useGetPatientQuery(patientId);
  // The summary carries the assigned doctor as a bare id (decision #13);
  // the name joins through the single-doctor read once the id is known.
  const assignedDoctor = useGetDoctorQuery(patient.data?.doctorId ?? "", {
    skip: patient.data === undefined,
  });

  const [confirmDelete, setConfirmDelete] = useState(false);

  const data = patient.data; // const capture — narrows inside JSX + callbacks

  return (
    <section>
      <Link className="backLink" href="/patients">
        ← Back to patients
      </Link>

      {patient.isLoading ? (
        <p className="emptyState">Loading patient…</p>
      ) : patient.error ? (
        <p className="alert" role="alert">
          {failureMessage(patient.error)}
        </p>
      ) : data ? (
        <>
          <div className="pageHead">
            <div>
              <h1>{data.name}</h1>
              <p className="mutedSmall">
                On record since {formatDateTime(data.createdAt)}
              </p>
            </div>
            <div className="headActions">
              <Link className="button buttonSm" href={`/patients/${patientId}/edit`}>
                Edit
              </Link>
              <button className="btnGhost dangerText" type="button" onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            </div>
          </div>

          <div className="detailGrid">
            <div className="detailItem">
              <span className="detailLabel">Condition</span>
              <span className="detailValue">
                <span className="chip">{data.condition}</span>
              </span>
            </div>
            <div className="detailItem">
              <span className="detailLabel">Assigned doctor</span>
              <span className="detailValue">
                {assignedDoctor.isLoading ? (
                  "Loading…"
                ) : assignedDoctor.data ? (
                  <Link className="rowLink" href={`/doctors/${data.doctorId}`}>
                    {assignedDoctor.data.name}
                  </Link>
                ) : (
                  "Unknown doctor"
                )}
              </span>
            </div>
            <div className="detailItem">
              <span className="detailLabel">Phone</span>
              <span className="detailValue">{data.phone ?? "—"}</span>
            </div>
            <div className="detailItem">
              <span className="detailLabel">Email</span>
              <span className="detailValue">{data.email ?? "—"}</span>
            </div>
            <div className="detailItem">
              <span className="detailLabel">Age</span>
              <span className="detailValue">{data.age !== undefined ? `${data.age} years` : "—"}</span>
            </div>
            <div className="detailItem">
              <span className="detailLabel">Gender</span>
              <span className="detailValue">{data.gender ?? "—"}</span>
            </div>
            <div className="detailItem">
              <span className="detailLabel">Created</span>
              <span className="detailValue">{formatDateTime(data.createdAt)}</span>
            </div>
            <div className="detailItem">
              <span className="detailLabel">Last updated</span>
              <span className="detailValue">{formatDateTime(data.updatedAt)}</span>
            </div>
          </div>
        </>
      ) : (
        <p className="emptyState">Patient not found.</p>
      )}

      {confirmDelete && data && (
        <ConfirmPatientDelete
          patient={{ id: patientId, name: data.name, doctorId: data.doctorId }}
          onClose={(deleted) => {
            setConfirmDelete(false);
            // The list refetches via LIST-tag invalidation; this page itself
            // would 404 on refetch — leave for the registry view.
            if (deleted) router.replace("/patients");
          }}
        />
      )}
    </section>
  );
}
