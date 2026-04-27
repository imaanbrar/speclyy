# Migrations

Raw SQL migrations for the single Supabase project (`speclyy`) per [ADR-0021](../../../docs/architecture/adr/0021-single-supabase-project.md).

## How to apply

Until `drizzle-kit` is wired up, apply migrations manually in order:

1. Open Supabase Dashboard → `speclyy` project → **SQL Editor**.
2. Paste the contents of the next unapplied file (smallest number first).
3. **Run**. All files use `BEGIN … COMMIT` so failures leave the DB untouched.

## Files

| # | File | Notes |
|---|------|-------|
| 0001 | `0001_initial_schema.sql` | profiles / organizations / organization_members / subscriptions + `handle_new_user` trigger + baseline RLS policies. Idempotent — safe to re-run. |
| 0002 | `0002_fix_organization_members_rls_recursion.sql` | Strips the self-referencing subquery from `organization_members: self read` (caused `ERROR: infinite recursion detected in policy`). Reads are now `user_id = auth.uid()` only; teammate visibility will land later via a SECURITY DEFINER helper. |
| 0003 | `0003_organizations_creator_visibility_and_profiles_self_insert.sql` | Adds `organizations.created_by uuid DEFAULT auth.uid()` and a creator branch to the SELECT policy (lets `.insert(...).select('id')` pass `INSERT ... RETURNING` — the row is visible via creator before membership is wired). Adds `profiles: self insert` so the `ensureProfile` self-heal upsert isn't denied. |

## Conventions

- **Numbered filenames**, zero-padded.
- **Wrapped in `BEGIN … COMMIT`** so a failure rolls back cleanly.
- **Idempotent** where possible (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`).
  Trigger functions use `CREATE OR REPLACE`.
- **Never edit an already-applied migration** — write a new one.
