# Architecture — Doctor Tracker

A living document, kept in sync with the implemented state as steps complete.

## Monorepo layout (npm workspaces)

- `apps/api` — Express REST API backend (scaffolded in Step 2)
- `apps/web` — Next.js App Router frontend (scaffolded in Step 8)
- `docs/` — design and decision documentation

Root tooling: TypeScript, ESLint 10 (flat config), npm workspaces for install and script
orchestration across workspaces. Runtime configuration lives in a single `.env` at the
repository root (placeholders documented in `.env.example`) — loaded by the API from the
repo root today, and by the frontend when it scaffolded.

## System shape — three responsibilities, one repository

- **Frontend (`apps/web`)**: presentation, interaction, forms, charts. Communicates only with
  the REST API — no direct database access and no business rules. Client state handled with
  Redux Toolkit; server data fetched through **RTK Query** typed endpoints with tag-based
  cache invalidation so cached sensitive data cannot silently go stale.
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
- **Doctor–patient relationship**: the patient document holds a required, validated
  `doctorId` reference — the single source of truth. A doctor's patient list is derived by
  query, never duplicated in a second collection.
- **Deletion policies**: patients are hard-deleted after an explicit confirmation dialog;
  doctor deletion is rejected with `409 Conflict` while any patient remains assigned.

## Development considerations (Atlas)

Dev queries traverse the internet; development data is synthetic only, stored in a dev
database (`doctor_tracker_dev`) distinct from anything real, and no Atlas-proprietary
features are used so the application remains portable to any MongoDB 8.x instance.
