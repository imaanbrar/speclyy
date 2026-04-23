# Shared-auth migrations

Raw SQL migrations for the **shared auth Supabase project** (`speclyy-auth`).

## How to apply

Until `drizzle-kit` is wired up for this DB (it requires a direct connection
string that we haven't added to `.env.local` yet for the shared-auth project),
apply migrations manually in order:

1. Open Supabase Dashboard → `speclyy-auth` project → **SQL Editor**.
2. Paste the contents of the next unapplied file (smallest number first).
3. **Run**. All files use `BEGIN … COMMIT` so failures leave the DB untouched.

## Files

| # | File | Notes |
|---|------|-------|
| 0001 | `0001_initial_auth_schema.sql` | profiles / organizations / organization_members / subscriptions + `handle_new_user` trigger + baseline RLS policies. Idempotent — safe to re-run. |

## Conventions

- **Numbered filenames**, zero-padded.
- **Wrapped in `BEGIN … COMMIT`** so a failure rolls back cleanly.
- **Idempotent** where possible (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`).
  Trigger functions use `CREATE OR REPLACE`.
- **Never edit an already-applied migration** — write a new one.
