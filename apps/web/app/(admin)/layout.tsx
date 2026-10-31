"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useLogoutMutation, useMeQuery } from "@/lib/api/api";
import { failureMessage, isUnauthorized } from "@/lib/api/api-errors";

/**
 * The protected shell. The server cannot own this decision — the session is
 * an HttpOnly cookie invisible to the Next server, so the guard consults the
 * live RTK Query session:
 *   - HTTP 401  ⇒ bounce to /login before anything protected renders;
 *   - transport failure ⇒ a reconnect panel instead of a stranded page.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const me = useMeQuery();
  const [logout, { isLoading: signingOut }] = useLogoutMutation();

  useEffect(() => {
    if (me.error && isUnauthorized(me.error)) router.replace("/login");
  }, [me.error, router]);

  async function handleLogout() {
    try {
      await logout().unwrap();
    } finally {
      // The store's listener middleware resets the RTK cache on logout;
      // this navigation merely completes the move.
      router.replace("/login");
    }
  }

  if (me.isLoading) {
    return (
      <main className="loginShell">
        <p className="note">Checking your session…</p>
      </main>
    );
  }

  if (me.error && !isUnauthorized(me.error)) {
    return (
      <main className="loginShell">
        <section className="loginCard">
          <h1 className="brand">Doctor Tracker</h1>
          <p className="alert" role="alert">
            {failureMessage(me.error)}
          </p>
          <button className="button" type="button" onClick={() => void me.refetch()}>
            Try again
          </button>
        </section>
      </main>
    );
  }

  if (!me.data) {
    // 401 → the redirect above is in flight.
    return (
      <main className="loginShell">
        <p className="note">Redirecting to sign-in…</p>
      </main>
    );
  }

  const admin = me.data.admin;

  return (
    <div className="adminShell">
      <header className="adminHeader">
        <p className="brandSmall">Doctor Tracker</p>
        <nav className="adminNav" aria-label="Console sections">
          <Link href="/doctors">Doctors</Link>
          <Link href="/patients">Patients</Link>
          <Link href="/dashboard">Dashboard</Link>
        </nav>
        <p className="sessionInfo">
          {admin.name} · {admin.email}
        </p>
        <button className="logoutButton" type="button" onClick={() => void handleLogout()} disabled={signingOut}>
          Sign out
        </button>
      </header>
      <main className="adminMain">
        <div className="page">{children}</div>
      </main>
    </div>
  );
}
