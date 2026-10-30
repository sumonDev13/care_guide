# Architecture — Doctor Tracker

A living document, kept in sync with the implemented state as steps complete.

## Monorepo layout (npm workspaces)

- `apps/api` — Express REST API backend (scaffolded in Step 2)
- `apps/web` — Next.js App Router frontend (scaffolded in Step 8)
- `docs/` — design and decision documentation

Root tooling: TypeScript, ESLint 10 (flat config), npm workspaces for install and script
orchestration across workspaces.

## System shape — three responsibilities, one repository

- **Frontend (`apps/web`)**: presentation, interaction, forms, charts. Communicates only with
  the REST API — no direct database access and no business rules. Client state handled with
  Redux Toolkit; server data fetched through **RTK Query** typed endpoints with tag-based
  cache invalidation so cached sensitive data cannot silently go stale.
- **Backend (`apps/api`)**: authentication, authorization, validation, business logic, and
  data access. The sole owner of MongoDB. No application logic in Next.js route handlers.
- **Database**: MongoDB on Atlas (web-hosted), accessed via Mongoose. Relationships modeled
  with document references; indexes justified by measured query patterns (see
  `docs/decisions.md` and the delivered README for indexing rationale).

## Core flows (planned, refined during implementation)

- **Auth**: admin logs in → backend issues an opaque random session token in an `HttpOnly`
  `SameSite` cookie → only the SHA-256 hash of the token is stored in MongoDB in a
  TTL-indexed `sessions` collection → every protected endpoint verifies via auth middleware
  → logout removes the session server-side and clears the cookie. Nothing sensitive lives
  in browser storage.
- **Doctor–patient relationship**: the patient document holds a required, validated
  `doctorId` reference — the single source of truth. A doctor's patient list is derived by
  query, never duplicated in a second collection.
- **Deletion policies**: patients are hard-deleted after an explicit confirmation dialog;
  doctor deletion is rejected with `409 Conflict` while any patient remains assigned.

## Development considerations (Atlas)

Dev queries traverse the internet; development data is synthetic only, stored in a dev
database (`doctor_tracker_dev`) distinct from anything real, and no Atlas-proprietary
features are used so the application remains portable to any MongoDB 8.x instance.
