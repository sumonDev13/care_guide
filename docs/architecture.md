# Architecture — Doctor Tracker

A living document, kept in sync with the implemented state as steps complete.

## Monorepo layout (npm workspaces)

- `apps/api` — Express REST API backend (scaffolded in Step 2)
- `apps/web` — Next.js 16 App Router frontend (scaffolded in Step 8): route groups
  (`(admin)` = protected shell, `login` = public), a Redux Toolkit store with a single
  typed RTK Query slice under `lib/api/`, and a same-origin `/api/*` proxy configured in
  `next.config.ts`
- `docs/` — design and decision documentation

Root tooling: TypeScript, ESLint 10 (flat config), npm workspaces for install and script
orchestration across workspaces. Runtime configuration lives in a single `.env` at the
repository root (placeholders documented in `.env.example`) — loaded by the API from the
repo root. The frontend takes no env in development (its proxy default targets
`http://localhost:4000`); in production the web process receives `WEB_API_ORIGIN` through
its deployment environment (Next.js reads `.env` files only from its own root, so the
single-root policy applies to the API).

## System shape — three responsibilities, one repository

- **Frontend (`apps/web`)**: presentation, interaction, forms, charts. Communicates only with
  the REST API — no direct database access and no business rules. Client state handled with
  Redux Toolkit; server data fetched through **RTK Query** typed endpoints with tag-based
  cache invalidation so cached sensitive data cannot silently go stale. All API traffic is
  same-origin: the Next server proxies `/api/:path*` to the API process (decision #18), so
  the `dt_session` cookie is first-party, the browser's `Origin` header reaches the API
  unchanged through the CSRF allowlist, and no CORS surface exists. The web process
  receives `WEB_API_ORIGIN` via its environment (default `http://localhost:4000` in dev).
- **Backend (`apps/api`)**: authentication, authorization, validation, business logic, and
  data access. The sole owner of MongoDB. No application logic in Next.js route handlers.
- **Database**: MongoDB on Atlas (web-hosted), accessed via Mongoose. One memoized connection
  per process (explicit `dbName`; a single cluster hosts dev/test/prod as separate
  databases). Relationships modeled with document references; indexes justified by measured
  query patterns (see `docs/decisions.md` and the delivered README for indexing rationale).
  The boot sequence hard-fails without a reachable database; health exposes liveness with
  truthful `database.state` in the payload.

- **Verification policy (decision #15)** — no automated test suite in this project by user
  choice: every feature step keeps `typecheck`, `lint` and `build` green and is verified
  with guided live smoke checks against the dev database (synthetic-only data). Automated
  testing is a documented future improvement.

- **Schemas & indexes** (Step 4): `Doctor` (name/specialization/hospital/phone/lowercase
  unique email) and `Patient` (name, phone/email with a both-must-not-be-empty rule, coarse
  condition enum, required validated `doctor` reference, optional age/gender). Query-pattern
  indexes: doctors `{email unique, createdAt:-1, [specialization,hospital]+createdAt}`;
  patients `{[doctor, condition]+createdAt, createdAt:-1}`. Seed script (`npm run seed
  -w apps/api`) generates deterministic synthetic-only data (refuses `NODE_ENV=production`).

## Core flows (planned, refined during implementation)

- **Auth**: admin logs in → backend issues an opaque random session token in an `HttpOnly`
  `SameSite` cookie → only the SHA-256 hash of the token is stored in MongoDB in a
  TTL-indexed `sessions` collection → every protected endpoint verifies via auth middleware
  → logout removes the session server-side and clears the cookie. Nothing sensitive lives
  in browser storage. Login throttling (8 attempts / 15 min per IP) and triple CSRF
  defenses (SameSite + Origin allowlist + required `X-Requested-With` header on
  mutations) are wired at this layer; administrator accounts are created only through the
  `create-admin` script (documented, prompts for a password, refuses duplicated emails).
- **Frontend session (Step 8)**: the browser talks only to the Next server (same-origin
  `/api` proxy), so the auth cookie never enters cross-site territory and the CSRF gate
  sees the browser's own `Origin`. The `(admin)` route-group layout guards rendering on
  the live `GET /api/auth/me` result — `401` redirects to `/login`, a broken API produces
  a reconnect panel — because the `HttpOnly` cookie is invisible to the Next server and
  server layouts cannot know about sessions. `/login` probes the same endpoint to bounce
  already-authenticated visitors. Mutations inject `X-Requested-With: XMLHttpRequest`
  centrally in fetchBaseQuery's `prepareHeaders`; logout resets the entire RTK cache via
  a store listener middleware so protected data never outlives the session client-side.
- **Doctors UI (Step 9)**: `/doctors` renders the API's decision #16 contract as a
  server-driven table — debounced inputs for `search`/`specialization`/`hospital`, a
  whitelisted sort select and a previous/next pager fed by the list `meta`. Forms carry
  zero duplicated client rules: submissions surface the API's 422 field details verbatim
  (and 409/429 messages as alerts) — decision #19's API-first validation. Tags follow a
  `LIST`-sentinel + per-id layout so every write keeps the visible pages truthful with
  minimal refetching. Deletion requires an explicit confirm dialog and renders the API's
  409 "patients still assigned" guidance inline. The doctor detail page also hosts the
  per-doctor patient pages (`GET /api/doctors/:id/patients`) with condition/sort filters.
- **Patients UI (Step 10)**: `/patients` mirrors the doctors table with the API's
  patient list surface — debounced search, `condition` and doctor-filter selects (both
  fed by one doctor-directory query), whitelisted sorts and the pager. The payload only
  carries a bare `doctorId` (no denormalized doctor data), so the table joins doctor
  names client-side from the directory map. Create renders the API-first validation
  pattern with the contact-rule hint; the doctor picker blocks submission until the
  directory loads. Edit is where #17's tri-state patch semantics become explicit
  controls: a filled field means "set", a per-field Clear checkbox (phone/email/age) or
  the `__clear__` gender sentinel means JSON `null` → `$unset`, and an emptied field
  means the key is omitted (value untouched). A non-numeric age is caught locally so it
  can never serialize as NaN → `null` and silently clear the stored age. Patient
  mutations invalidate both tag families — the patient tags plus the original (and, on
  reassignment, the new) doctor tag — keeping per-doctor patient pages and counts
  truthful without manual refetch wiring. Deletion is a confirmed HARD delete; the
  detail page's delete navigates back to the registry afterwards.
- **Doctor–patient relationship**: the patient document holds a required, validated
  `doctorId` reference — the single source of truth. A doctor's patient list is derived by
  query, never duplicated in a second collection.
- **Doctors API (Step 6)**: everything sits under `/api/doctors`, session-guarded —
  `POST /` create (201), `GET /` list with search/filter/sort/pagination (decision #16
  conventions), `GET /:id` detail, `PATCH /:id` edit (model validators run on updates), and
  `GET /:id/patients` paged patient listings per doctor. Duplicate emails surface as
  `409 Conflict` (mapped from the Mongo E11000 unique-index signal — also true when a
  PATCH collides); no-op PATCH bodies are a 422; malformed route ids are a 400; absent
  resources a 404. Doctor deletion deliberately lands with the patients API (Step 7) so
  both deletion rules ship together (decision #6).
- **Patients API (Step 7)**: everything sits under `/api/patients`, session-guarded —
  `POST /` create (201), `GET /` list (search across name/email/phone, `condition` and
  `doctor` filters, `name|condition|createdAt` sorts, decision #16 pagination),
  `GET /:id` detail, `PATCH /:id` edit, and `DELETE /:id` hard delete. Patient edits merge
  the patch into the current state and validate the FULL merged state before writing so
  the contact rule ("at least one of phone/email") holds for any piecewise edit; optional
  fields clear through JSON `null` (implemented via `$unset`, since Mongoose drops
  `$set: undefined`); reassignment to a different doctor re-verifies the new doctor's
  existence. Model `runValidators` is deliberately OFF for the merged-state PATCH write —
  Mongoose update validators cannot resolve `this`-dependent cross-field rules; creation
  keeps the model backstop, and the central error handler maps stray Mongoose
  `ValidationError`s to the standard 422 envelope.

## Core flows (planned, refined during implementation) — deletion policies (wired in Step 7)

- **Patients** are hard-deleted (`DELETE /api/patients/:id`) after an explicit confirmation
  dialog on the frontend; the API exposes exactly one delete verb, so stale sensitive data
  cannot linger behind soft-delete flags.
- **Doctors** are deleted only when no patient remains assigned (`DELETE /api/doctors/:id`
  → `409 Conflict` otherwise, no cascade). The patient-side pre("save") doctor-existence
  hook closes the race window between the assignment check and the delete, so neither
  direction can orphan a reference without transactions.

## Development considerations (Atlas)

Dev queries traverse the internet; development data is synthetic only, stored in a dev
database (`doctor_tracker_dev`) distinct from anything real, and no Atlas-proprietary
features are used so the application remains portable to any MongoDB 8.x instance.
