"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  useGetDoctorsQuery,
  useGetPatientsQuery,
} from "@/lib/api/api";
import type { PatientSummary } from "@/lib/api/types";
import { PATIENT_CONDITIONS } from "@/lib/api/types";
import { failureMessage } from "@/lib/api/api-errors";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { formatDateTime } from "@/lib/ui/format";
import { Pager } from "@/lib/ui/pager";
import { ConfirmPatientDelete } from "./_components/confirm-patient-delete";

const SORT_OPTIONS = [
  { value: "-createdAt", label: "Newest first" },
  { value: "createdAt", label: "Oldest first" },
  { value: "name", label: "Name (A–Z)" },
  { value: "-name", label: "Name (Z–A)" },
  { value: "condition", label: "Condition (A–Z)" },
  { value: "-condition", label: "Condition (Z–A)" },
] as const;

const PAGE_SIZE = 10;

export default function PatientsPage() {
  const router = useRouter();

  const [searchDraft, setSearchDraft] = useState("");
  const [condition, setCondition] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("");
  const [sort, setSort] = useState<string>("-createdAt");
  const [page, setPage] = useState(1);

  const search = useDebouncedValue(searchDraft);

  useEffect(() => {
    setPage(1);
  }, [search, condition, doctorFilter, sort]);

  // The registry list carries bare doctorIds (decision #13); the doctor
  // directory (same query feeds the filter select) joins names client-side.
  const doctorsQuery = useGetDoctorsQuery({ limit: 100, sort: "name" });
  const doctorNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const doctor of doctorsQuery.data?.doctors ?? []) {
      map.set(doctor.id, doctor.name);
    }
    return map;
  }, [doctorsQuery.data]);

  const query = useGetPatientsQuery({
    search,
    condition,
    doctor: doctorFilter,
    sort,
    page,
    limit: PAGE_SIZE,
  });

  const [toDelete, setToDelete] = useState<Pick<PatientSummary, "id" | "name" | "doctorId"> | null>(null);

  function resetFilters() {
    setSearchDraft("");
    setCondition("");
    setDoctorFilter("");
  }

  const patients = query.data?.patients ?? [];
  const meta = query.data?.meta;

  return (
    <section>
      <div className="pageHead">
        <div>
          <h1>Patients</h1>
          {meta && (
            <p className="mutedSmall">
              {meta.total} {meta.total === 1 ? "patient" : "patients"} on record
            </p>
          )}
        </div>
        <button className="button buttonSm" type="button" onClick={() => router.push("/patients/new")}>
          Add patient
        </button>
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search name, email, phone…"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          aria-label="Search patients"
        />
        <select value={condition} onChange={(event) => setCondition(event.target.value)} aria-label="Filter by condition">
          <option value="">All conditions</option>
          {PATIENT_CONDITIONS.map((item) => (
            <option key={item} value={item}>
              {item[0]?.toUpperCase() + item.slice(1)}
            </option>
          ))}
        </select>
        <select value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value)} aria-label="Filter by doctor">
          <option value="">All doctors</option>
          {(doctorsQuery.data?.doctors ?? []).map((doctor) => (
            <option key={doctor.id} value={doctor.id}>
              {doctor.name}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort patients">
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {(search !== "" || condition !== "" || doctorFilter !== "") && (
          <button className="btnGhost" type="button" onClick={resetFilters}>
            Clear filters
          </button>
        )}
      </div>

      <div className="tableCard">
        {query.isLoading ? (
          <p className="emptyState">Loading patients…</p>
        ) : query.error ? (
          <p className="alert" role="alert">
            {failureMessage(query.error)}
          </p>
        ) : patients.length === 0 ? (
          <p className="emptyState">No patients match the current filters.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Condition</th>
                <th>Doctor</th>
                <th>Created</th>
                <th className="thActions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr key={patient.id}>
                  <td>
                    <Link className="rowLink" href={`/patients/${patient.id}`}>
                      {patient.name}
                    </Link>
                  </td>
                  <td className="cellMuted">{patient.phone ?? patient.email ?? "—"}</td>
                  <td>
                    <span className="chip">{patient.condition}</span>
                  </td>
                  <td>
                    <Link className="rowLink" href={`/doctors/${patient.doctorId}`}>
                      {doctorNames.get(patient.doctorId) ?? "Unknown doctor"}
                    </Link>
                  </td>
                  <td className="cellMuted">{formatDateTime(patient.createdAt)}</td>
                  <td className="cellActions">
                    <Link className="btnGhost" href={`/patients/${patient.id}/edit`}>
                      Edit
                    </Link>
                    <button
                      className="btnGhost dangerText"
                      type="button"
                      onClick={() => setToDelete({ id: patient.id, name: patient.name, doctorId: patient.doctorId })}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {meta && <Pager meta={meta} onPage={setPage} />}
      </div>

      {toDelete && (
        <ConfirmPatientDelete
          patient={toDelete}
          onClose={() => setToDelete(null)} // list refreshes via LIST-tag invalidation
        />
      )}
    </section>
  );
}
