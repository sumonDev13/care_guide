"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useLoginMutation, useMeQuery } from "@/lib/api/api";
import { failureMessage } from "@/lib/api/api-errors";

/**
 * Public sign-in surface. The session is probed live (`me`) so already
 * authenticated visitors bounce straight to the console instead of being
 * offered a second login; unauthenticated visitors get the form.
 */
export default function LoginPage() {
  const router = useRouter();
  const me = useMeQuery();
  const [login, { isLoading: signingIn }] = useLoginMutation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me.data) router.replace("/");
  }, [me.data, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await login({ email, password }).unwrap();
      router.replace("/");
    } catch (failure) {
      setError(failureMessage(failure));
    }
  }

  return (
    <main className="loginShell">
      <section className="loginCard">
        <h1 className="brand">Doctor Tracker</h1>
        <p className="tagline">Administrative console — staff sign-in</p>

        {me.isLoading ? (
          <p className="cardNote">Checking your session…</p>
        ) : me.data ? (
          <p className="cardNote">Signed in — opening the console…</p>
        ) : (
          <>
            {error && (
              <p className="alert" role="alert">
                {error}
              </p>
            )}
            <form onSubmit={handleSubmit} noValidate>
              <label className="field">
                <span>Email</span>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={signingIn}
                />
              </label>
              <label className="field">
                <span>Password</span>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={signingIn}
                />
              </label>
              <button className="button" type="submit" disabled={signingIn}>
                {signingIn ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
