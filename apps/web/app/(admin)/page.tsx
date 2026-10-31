import Link from "next/link";

/**
 * Console home. Employees land here after sign-in; every card points at an
 * administration surface. Rendered inside the (admin) layout guard, so this
 * content is already authenticated.
 */
export default function AdminHomePage() {
  return (
    <section>
      <h1>Console overview</h1>
      <p className="muted">
        Administration surfaces of the doctor &amp; patient registry.
      </p>

      <ul className="homeLinks">
        <li>
          <Link className="homeCard" href="/doctors">
            <strong>Doctors</strong>
            <span>
              Search, filter and sort the registry; create and edit records;
              open per-doctor patient pages; delete with the assigned-patients
              guard.
            </span>
          </Link>
        </li>
        <li>
          <Link className="homeCard" href="/patients">
            <strong>Patients</strong>
            <span>
              Search, filter and sort the full registry; create and edit
              records (contact rule, doctor reassignment, null-clear fields);
              delete with hard-delete confirmation.
            </span>
          </Link>
        </li>
      </ul>
    </section>
  );
}
