"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  useGetDoctorsQuery,
} from "@/lib/api/api";
import type { DoctorSummary } from "@/lib/api/types";
import { failureMessage } from "@/lib/api/api-errors";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { formatDateTime } from "@/lib/ui/format";
import { Pager } from "@/lib/ui/pager";
import { ConfirmDoctorDelete } from "./_components/confirm-doctor-delete";

/** Whitelisted client-side (mirrors the API's sort schema, decision #16). */
const SORT_OPTIONS = [
  { value: "-createdAt", label: "Newest first" },
  { value: "createdAt", label: "Oldest first" },
  { value: "name", label: "Name (A–Z)" },
  { value: "-name", label: "Name (Z–A)" },
  { value: "specialization", label: "Specialization (A–Z)" },
  { value: "hospital", label: "Hospital (A–Z)" },
] as const;

const PAGE_SIZE = 10;

export default function DoctorsPage() {
  const router = useRouter();

  const [searchDraft, setSearchDraft] = useState("");
  const [specializationDraft, setSpecializationDraft] = useState("");
  const [hospitalDraft, setHospitalDraft] = useState("");
  const [sort, setSort] = useState<string>("-createdAt");
  const [page, setPage] = useState(1);

  const search = useDebouncedValue(searchDraft);
  const specialization = useDebouncedValue(specializationDraft);
  const hospital = useDebouncedValue(hospitalDraft);

  // Every pivot of the filters restarts paging.
  useEffect(() => {
    setPage(1);
  }, [search, specialization, hospital, sort]);

  const query = useGetDoctorsQuery({ search, specialization, hospital, sort, page, limit: PAGE_SIZE });

  const [toDelete, setToDelete] = useState<Pick<DoctorSummary, "id" | "name"> | null>(null);

  function resetFilters() {
    setSearchDraft("");
    setSpecializationDraft("");
    setHospitalDraft("");
    setSort("-createdAt");
  }

  const doctors = query.data?.doctors ?? [];
  const meta = query.data?.meta;

  return (
    <section>
      <div className="pageHead">
        <div>
          <h1>Doctors</h1>
          {meta && (
            <p className="mutedSmall">
              {meta.total} {meta.total === 1 ? "doctor" : "doctors"} on record
            </p>
          )}
        </div>
        <button className="button buttonSm" type="button" onClick={() => router.push("/doctors/new")}>
          Add doctor
        </button>
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search name, email, phone, hospital…"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          aria-label="Search doctors"
        />
        <input
          type="text"
          placeholder="Specialization (exact)"
          value={specializationDraft}
          onChange={(event) => setSpecializationDraft(event.target.value)}
          aria-label="Filter by specialization"
          maxLength={80}
        />
        <input
          type="text"
          placeholder="Hospital (exact)"
          value={hospitalDraft}
          onChange={(event) => setHospitalDraft(event.target.value)}
          aria-label="Filter by hospital"
          maxLength={200}
        />
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort doctors">
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {(search !== "" || specialization !== "" || hospital !== "") && (
          <button className="btnGhost" type="button" onClick={resetFilters}>
            Clear filters
          </button>
        )}
      </div>

      <div className="tableCard">
        {query.isLoading ? (
          <p className="emptyState">Loading doctors…</p>
        ) : query.error ? (
          <p className="alert" role="alert">
            {failureMessage(query.error)}
          </p>
        ) : doctors.length === 0 ? (
          <p className="emptyState">No doctors match the current filters.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Specialization</th>
                <th>Hospital</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Created</th>
                <th className="thActions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {doctors.map((doctor) => (
                <tr key={doctor.id}>
                  <td>
                    <Link className="rowLink" href={`/doctors/${doctor.id}`}>
                      {doctor.name}
                    </Link>
                  </td>
                  <td>{doctor.specialization}</td>
                  <td>{doctor.hospital}</td>
                  <td>{doctor.phone}</td>
                  <td>{doctor.email}</td>
                  <td className="cellMuted">{formatDateTime(doctor.createdAt)}</td>
                  <td className="cellActions">
                    <Link className="btnGhost" href={`/doctors/${doctor.id}/edit`}>
                      Edit
                    </Link>
                    <button
                      className="btnGhost dangerText"
                      type="button"
                      onClick={() => setToDelete({ id: doctor.id, name: doctor.name })}
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
        <ConfirmDoctorDelete
          doctor={toDelete}
          onClose={() => setToDelete(null)} // list refreshes via LIST-tag invalidation
        />
      )}
    </section>
  );
}
