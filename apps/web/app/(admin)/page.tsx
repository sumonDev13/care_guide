/**
 * Protected home (Step 8 placeholder): the session guard lives in this
 * route group's layout, so everything rendered here is already
 * authenticated. The doctor/patient administration surfaces land in
 * Steps 9-10.
 */
export default function AdminHomePage() {
  return (
    <section>
      <h1>Doctors &amp; patients</h1>
      <p className="muted">
        The doctor and patient administration surfaces land in the next steps.
        Your session, this layout guard and the whole API wiring are already
        live.
      </p>
    </section>
  );
}
