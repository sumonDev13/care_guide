"use client";

import Link from "next/link";
import {
  useGetDashboardStatsQuery,
} from "@/lib/api/api";
import { failureMessage } from "@/lib/api/api-errors";
import { formatDateTime } from "@/lib/ui/format";

export default function DashboardPage() {
  const { data: stats, isLoading, error } = useGetDashboardStatsQuery();

  if (isLoading) {
    return (
      <section className="page">
        <h1>Dashboard</h1>
        <p className="emptyState">Loading analytics…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page">
        <h1>Dashboard</h1>
        <p className="alert" role="alert">
          {failureMessage(error)}
        </p>
      </section>
    );
  }

  if (!stats) {
    return (
      <section className="page">
        <h1>Dashboard</h1>
        <p className="emptyState">No data available.</p>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="pageHead">
        <h1>Dashboard</h1>
        <p className="mutedSmall">
          Registry analytics at a glance.
        </p>
      </div>

      <div className="statsGrid">
        <div className="statCard">
          <span className="statLabel">Doctors</span>
          <span className="statValue">{stats.doctorsTotal}</span>
        </div>
        <div className="statCard">
          <span className="statLabel">Patients</span>
          <span className="statValue">{stats.patientsTotal}</span>
        </div>
      </div>

      <div className="dashboardGrid">
        <div className="chartCard">
          <h2>Patients by Condition</h2>
          <div className="chartBars">
            {stats.patientsByCondition.map((row) => {
              const pct = stats.patientsTotal
                ? Math.round((row.count / stats.patientsTotal) * 100)
                : 0;
              return (
                <div key={row.condition} className="chartBarRow">
                  <span className="chartBarLabel">{row.condition}</span>
                  <div className="chartBarTrack">
                    <div className="chartBarFill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="chartBarValue">{row.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="chartCard">
          <h2>Doctors by Specialization</h2>
          <div className="chartBars">
            {stats.doctorsBySpecialization.map((row) => {
              const pct = stats.doctorsTotal
                ? Math.round((row.count / stats.doctorsTotal) * 100)
                : 0;
              return (
                <div key={row.specialization} className="chartBarRow">
                  <span className="chartBarLabel">{row.specialization}</span>
                  <div className="chartBarTrack">
                    <div className="chartBarFill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="chartBarValue">{row.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="chartCard">
          <h2>Doctors by Hospital</h2>
          <div className="chartBars">
            {stats.doctorsByHospital.map((row) => {
              const pct = stats.doctorsTotal
                ? Math.round((row.count / stats.doctorsTotal) * 100)
                : 0;
              return (
                <div key={row.hospital} className="chartBarRow">
                  <span className="chartBarLabel">{row.hospital}</span>
                  <div className="chartBarTrack">
                    <div className="chartBarFill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="chartBarValue">{row.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="chartCard">
          <h2>Top Doctors by Patient Count</h2>
          <div className="chartBars">
            {stats.patientsByDoctor.map((row) => {
              const maxCount = stats.patientsByDoctor[0]?.count ?? 0;
              const pct = maxCount ? Math.round((row.count / maxCount) * 100) : 0;
              return (
                <div key={row.doctorId} className="chartBarRow">
                  <span className="chartBarLabel">{row.doctorName}</span>
                  <div className="chartBarTrack">
                    <div className="chartBarFill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="chartBarValue">{row.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="recentGrid">
        <div className="recentCard">
          <h2>Recent Doctors</h2>
          {stats.recentDoctors.length === 0 ? (
            <p className="emptyState">No doctors on record.</p>
          ) : (
            <table className="table tableSmall">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Specialization</th>
                  <th>Hospital</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentDoctors.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <Link className="rowLink" href={`/doctors/${doc.id}`}>
                        {doc.name}
                      </Link>
                    </td>
                    <td>{doc.specialization}</td>
                    <td>{doc.hospital}</td>
                    <td className="cellMuted">
                      {formatDateTime(doc.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="recentCard">
          <h2>Recent Patients</h2>
          {stats.recentPatients.length === 0 ? (
            <p className="emptyState">No patients on record.</p>
          ) : (
            <table className="table tableSmall">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Condition</th>
                  <th>Doctor</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentPatients.map((pat) => (
                  <tr key={pat.id}>
                    <td>{pat.name}</td>
                    <td>
                      <span className="chip">{pat.condition}</span>
                    </td>
                    <td>{pat.doctorId}</td>
                    <td className="cellMuted">
                      {formatDateTime(pat.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}