"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  useGetDoctorPatientsQuery,
  useGetDoctorQuery,
} from "@/lib/api/api";
import { PATIENT_CONDITIONS } from "@/lib/api/types";
import { failureMessage } from "@/lib/api/api-errors";
import { formatDateTime } from "@/lib/ui/format";
import { Pager } from "@/lib/ui/pager";
import { ConfirmDoctorDelete } from "../_components/confirm-doctor-delete";

const PATIENT_PAGE_SIZE = 10;
const PATIENT_SORTS = [
  { value: "-createdAt", label: "Newest first" },
  { value: "createdAt", label: "Oldest first" },
  { value: "name", label: "Name (A–Z)" },
  { value: "-name", label: "Name (Z–A)" },
] as const;

export default function DoctorDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const doctorId = params.id;

  const doctor = useGetDoctorQuery(doctorId);

  const [condition, setCondition] = useState<string>("");
  const [patientSort, setPatientSort] = useState<string>("-createdAt");
  const [patientPage, setPatientPage] = useState(1);

  // Filter/license pivots restart the patient page (same as the doctors list).
  useEffect(() => {
    setPatientPage(1);
  }, [condition, patientSort]);

  const patientsQuery = useGetDoctorPatientsQuery({
    id: doctorId,
    params: { condition, sort: patientSort, page: patientPage, limit: PATIENT_PAGE_SIZE },
  });

  const [confirmDelete, setConfirmDelete] = useState(false);

  function resetPatientFilters() {
    setCondition("");
    setPatientSort("-createdAt");
  }

  const patients = patientsQuery.data?.patients ?? [];
  const meta = patientsQuery.data?.meta;

  return (
    <section>
      <Link className="backLink" href="/doctors">
        ← Back to doctors
      </Link>

      {doctor.isLoading ? (
        <p className="emptyState">Loading doctor…</p>
      ) : doctor.error ? (
        <p className="alert" role="alert">
          {failureMessage(doctor.error)}
        </p>
      ) : doctor.data ? (
        <>
          <div className="pageHead">
            <div>
              <h1>{doctor.data.name}</h1>
              <p className="mutedSmall">
                {doctor.data.specialization} · {doctor.data.hospital}
              </p>
            </div>
            <div className="headActions">
              <Link className="button buttonSm" href={`/doctors/${doctorId}/edit`}>
                Edit
              </Link>
              <button className="btnGhost dangerText" type="button" onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            </div>
          </div>

          <div className="detailGrid">
            <div className="detailItem">
              <span className="detailLabel">Phone</span>
              <span className="detailValue">{doctor.data.phone}</span>
            </div>
            <div className="detailItem">
              <span className="detailLabel">Email</span>
              <span className="detailValue">{doctor.data.email}</span>
            </div>
            <div className="detailItem">
              <span className="detailLabel">Created</span>
              <span className="detailValue">{formatDateTime(doctor.data.createdAt)}</span>
            </div>
            <div className="detailItem">
              <span className="detailLabel">Last updated</span>
              <span className="detailValue">{formatDateTime(doctor.data.updatedAt)}</span>
            </div>
          </div>

          <div className="sectionTitle">
            <h2>Assigned patients</h2>
            {meta && (
              <p className="mutedSmall">
                {meta.total} {meta.total === 1 ? "patient" : "patients"}
              </p>
            )}
          </div>

          <div className="toolbar">
            <select
              value={condition}
              onChange={(event) => setCondition(event.target.value)}
              aria-label="Filter patients by condition"
            >
              <option value="">All conditions</option>
              {PATIENT_CONDITIONS.map((item) => (
                <option key={item} value={item}>
                  {item[0]?.toUpperCase() + item.slice(1)}
                </option>
              ))}
            </select>
            <select
              value={patientSort}
              onChange={(event) => setPatientSort(event.target.value)}
              aria-label="Sort patients"
            >
              {PATIENT_SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {condition !== "" && (
              <button className="btnGhost" type="button" onClick={resetPatientFilters}>
                Clear filters
              </button>
            )}
          </div>

          <div className="tableCard">
            {patientsQuery.isLoading ? (
              <p className="emptyState">Loading patients…</p>
            ) : patientsQuery.error ? (
              <p className="alert" role="alert">
                {failureMessage(patientsQuery.error)}
              </p>
            ) : patients.length === 0 ? (
              <p className="emptyState">
                No patients are assigned to this doctor{condition ? " for this condition" : ""}.
              </p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>Condition</th>
                    <th>Age</th>
                    <th>Gender</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((patient) => (
                    <tr key={patient.id}>
                      <td>{patient.name}</td>
                      <td className="cellMuted">{patient.phone ?? patient.email ?? "—"}</td>
                      <td>
                        <span className="chip">{patient.condition}</span>
                      </td>
                      <td>{patient.age ?? "—"}</td>
                      <td className="cellMuted">{patient.gender ?? "—"}</td>
                      <td className="cellMuted">{formatDateTime(patient.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {meta && <Pager meta={meta} onPage={setPatientPage} />}
          </div>
        </>
      ) : (
        <p className="emptyState">Doctor not found.</p>
      )}

      {confirmDelete && doctor.data && (
        <ConfirmDoctorDelete
          doctor={{ id: doctorId, name: doctor.data.name }}
          onClose={(deleted) => {
            setConfirmDelete(false);
            // LIST invalidation refreshes the table; this page itself would
            // 404 on refetch — leave for the list view.
            if (deleted) router.replace("/doctors");
          }}
        />
      )}
    </section>
  );
}
