# @speclyy/db

Drizzle schema for the single Supabase project (per [ADR-0021](../../docs/architecture/adr/0021-single-supabase-project.md)).

## Contents

- `src/schema/` — Drizzle table definitions (one file per domain: `profiles`, `organizations`, `organization_members`, `subscriptions`, and future app tables).
- `src/client.ts` — Drizzle client factory. Accepts a Postgres connection string and returns a typed client. **Currently unused at runtime** — auth-group code reads/writes via the Supabase client + RLS (`@speclyy/auth`). The factory is reserved for tooling (drizzle-kit migrations, scripts) and for the day app-domain code wants direct SQL.
- `migrations/` — Raw SQL migrations applied to the Supabase project. See [migrations/README.md](migrations/README.md).
- `src/index.ts` — Public re-exports.

## Rules

- **Schema is the source of truth** for typegen. Migrations are hand-written SQL today; once `drizzle-kit` is wired up, they'll be generated from these tables.
- **No env var reads inside this package.** Callers pass connection strings explicitly — keeps the package usable from Server Actions, Route Handlers, scripts, and tests.
- **No Supabase client here.** That lives in `@speclyy/auth`. This package is pure Postgres / Drizzle.
