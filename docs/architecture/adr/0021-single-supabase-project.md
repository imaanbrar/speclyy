# ADR-0021: Single Supabase project for auth and app data

- **Status:** Accepted
- **Date:** 2026-04-26
- **Supersedes:** the per-app database boundary in [ADR-0019](0019-multi-app-architecture.md). The rest of ADR-0019 (organizations entity, members table, subscriptions entitlements, cookie-domain story for any future apps) still holds.

## Context

ADR-0019 split data along two axes:

1. **Shared auth project** — owns `auth.users` plus account-level tables (`profiles`, `organizations`, `organization_members`, `subscriptions`).
2. **Per-app database** — owns app-specific tables (projects, documents, etc.). References `user_id` / `organization_id` as opaque UUIDs with no cross-DB FK.

In practice that produced two Supabase projects: `speclyy-auth` (provisioned, in active use) and `speclyy` (provisioned but empty — no per-app tables exist yet).

The split was justified by "future apps under `*.speclyy.com` get their own data domains, isolated blast radius, independent schema evolution." None of those forces are present today: there is one app, it has no app-specific tables yet, and there is no concrete second app on the roadmap. Meanwhile the split costs:

- **Two connection strings to manage** (`NEXT_PUBLIC_SUPABASE_URL` and `DATABASE_URL` / `DATABASE_URL_POOLED`) — easy to mis-wire, and the README example in `@speclyy/db` already pointed Drizzle at the per-app DB while the schema barrel re-exported tables that physically lived in the auth project.
- **No cross-DB FK** between app data and `user_id` / `organization_id` — every join becomes an in-app stitch, every "delete cascade on user delete" becomes manual.
- **Two RLS surfaces** — once per-app tables ship, every policy that names `auth.uid()` has to know which project the table is in.
- **Two auth surfaces for ad-hoc tooling** — psql/migrations/scripts split across two databases.

For one app with no per-app tables yet, this is paying a multi-app tax for a single-app product.

## Decision

Collapse to **one Supabase project** that owns everything: `auth.users`, the four account-level tables from ADR-0019, and (in future) all app-specific tables. The project is renamed `speclyy` (was `speclyy-auth`); the empty per-app `speclyy` project is deleted.

Concretely:

- One project URL (`NEXT_PUBLIC_SUPABASE_URL`), one publishable key, one secret key.
- `DATABASE_URL` / `DATABASE_URL_POOLED` are removed from app env vars. Direct Postgres access (drizzle-kit migrations, ad-hoc scripts) reuses the same project's connection string when needed — it is no longer a separate "app DB."
- App-specific tables, when they ship, live in the same project as auth tables. Foreign keys to `auth.users.id` and `public.organizations.id` are real FKs.
- RLS uses the same `auth.uid()` everywhere; no JWT-bridging across projects.

ADR-0019's other decisions are unchanged:

- `organizations` table with `type` discriminator stays.
- `organization_members` join table from day one stays.
- `subscriptions.entitlements` jsonb stays.
- Cookie domain on `.speclyy.com` stays — if a second app under `*.speclyy.com` ever ships, it would talk to this same Supabase project for auth. It would also live in this project's DB (or call out via API to a different store), which is a decision for that day.

## Rationale

- **No production users, no per-app tables, no second app.** All three forces ADR-0019 cited are absent. Reverse the architectural cost while reversing is free.
- **Real foreign keys are worth a lot.** App tables that reference `user_id` / `organization_id` get cascade deletes, referential integrity, and joinable RLS policies for free in one project.
- **One mental model.** "All data lives in `speclyy`" is simpler to reason about than "auth-y data here, app data there, foreign keys are opaque UUIDs."
- **Reversible if a second app appears.** A future app can either share this project or get its own — the decision can be made when the second app is real, not pre-emptively.

## Consequences

**Positive**
- One connection string, one set of migrations, one RLS surface.
- Real foreign keys from app tables to `profiles` / `organizations`.
- Less env-var surface (`DATABASE_URL` / `DATABASE_URL_POOLED` removed).
- `@speclyy/db` no longer has a misleading two-DB framing.

**Negative**
- Lose per-app blast-radius isolation. A bad migration on app tables now sits in the same project as auth. Mitigation: migrations are reviewed; backups are project-wide.
- If a second app ships and needs schema isolation, we'll either share this project or migrate. Re-introducing a second DB later is the migration we avoided pre-emptively here — accepted cost.

## Alternatives considered

- **Keep two projects, populate the per-app DB with the first app table to "lock in" the boundary.** Rejected — pays the cost now to defend a future we may never need, and keeps the cross-DB-FK problem permanently.
- **Move auth tables out of Supabase entirely (custom auth + per-app DB).** Rejected — Supabase Auth is already chosen ([ADR-0005](0005-auth-provider.md)) and works.
- **Sharded-by-tenant on a single project.** Out of scope — single-tenant per organization for now.

## Migration

No production data exists. Steps:

1. In the Supabase dashboard, rename `speclyy-auth` → `speclyy`. Project URL / API keys / direct-connection string are unchanged (Supabase identifies projects by ref hash, not display name).
2. Delete the empty `speclyy` per-app project.
3. Remove `DATABASE_URL` / `DATABASE_URL_POOLED` from `apps/web/.env.local` and from Vercel env (Production + Preview).
4. Update docs and `@speclyy/db` to drop the two-DB framing (this ADR's accompanying changes).

The `0001_initial_auth_schema.sql` migration is unaffected — it already targets the project we're keeping. Future migrations land in the same `packages/db/migrations/` directory.

## References

- [ADR-0005 — Auth provider: Supabase Auth](0005-auth-provider.md)
- [ADR-0007 — Auth data model and middleware gates](0007-auth-data-model.md)
- [ADR-0008 — ORM: Drizzle](0008-orm.md)
- [ADR-0019 — Multi-app architecture](0019-multi-app-architecture.md) (per-app DB superseded here)
- [`../auth.md`](../auth.md) — runtime architecture
- [`../../operations/infra-provisioning.md`](../../operations/infra-provisioning.md) — provisioning runbook
