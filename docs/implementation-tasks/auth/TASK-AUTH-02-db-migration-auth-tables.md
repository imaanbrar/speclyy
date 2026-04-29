---
id: TASK-AUTH-02
title: Initial DB schema — profiles, organizations, members, subscriptions, trigger, RLS
group: auth
status: done
estimate: 3
dependencies: [TASK-AUTH-01]
related_screens: []
related_adrs: [ADR-0007, ADR-0016, ADR-0019]
created: 2026-04-22
---

# TASK-AUTH-02 — Initial auth schema

## Goal

Create the auth-adjacent schema in the single `speclyy` Supabase project (per [ADR-0021](../../architecture/adr/0021-single-supabase-project.md)): `profiles`, `organizations`, `organization_members`, `subscriptions`, the `handle_new_user()` trigger that back-fills `profiles` on `auth.users` insert, and the baseline RLS policies that make `auth.uid()` the *only* identity the database trusts. This is the structural foundation every later task builds on.

> **Greenfield DB.** The Supabase project provisioned in TASK-AUTH-01 has no pre-existing schema — this task lays down the initial DDL as the first migration Drizzle will record. There is **no production data to migrate from**; later schema changes will arrive as additive migrations, but tasks currently in this tracker (auth, onboarding, billing) all fold into this initial schema where possible.

## Scope

**In scope**
- Drizzle schema + initial migration (per [ADR-0008](../../architecture/adr/0008-orm.md)) containing the DDL from [`architecture/auth.md` § Data model](../../architecture/auth.md).
- The `AFTER INSERT` trigger on `auth.users` that inserts a blank `profiles` row.
- RLS enablement + baseline policies for all four tables.
- Indexes: `profiles_is_onboarded_idx`, `organizations_type_idx`, `organization_members_user_id_idx`, `subscriptions_user_id_idx`.
- Generated Drizzle types checked into the `@speclyy/db` (or shared-auth) package consumed by TASK-AUTH-03.

**Out of scope**
- Onboarding-driven writes (org creation, `onboarding_completed_at`) — those live in the onboarding group's Server Actions.
- Stripe webhook writes — billing group.
- Per-app tables (`projects`, `groups`, `items`, etc.) — separate group and separate DB per [ADR-0019](../../architecture/adr/0019-multi-app-architecture.md).

## Acceptance criteria

```gherkin
Scenario: Trigger back-fills profiles row on auth.users insert
  Given the initial schema has been applied
  When a new auth.users row is inserted (via Supabase Auth sign-up)
  Then a public.profiles row exists with the matching id
    And first_name, last_name, market, onboarding_completed_at are NULL
    And is_onboarded evaluates to false
    And has_visited_dashboard is false

Scenario: RLS blocks cross-user profile reads
  Given users U1 and U2 both have profiles rows
  When a client authenticated as U1 queries select * from profiles
  Then only U1's row is returned
    And queries filtering by id = U2 return zero rows (not an error)

Scenario: RLS blocks organization access for non-members
  Given U1 is a member of organization O1, U2 is not
  When a client authenticated as U2 queries organizations where id = O1
  Then zero rows are returned

Scenario: Subscriptions are read-only to owners at the RLS layer
  Given U1 has a subscriptions row
  When a client authenticated as U1 attempts an UPDATE or INSERT on subscriptions
  Then the write is rejected (no matching write policy)
    And a service_role client CAN perform the same write (bypasses RLS)

Scenario: Unique constraints hold
  Given two Stripe customers have synced subscriptions
  When a second row is attempted with a duplicate stripe_subscription_id
  Then the INSERT fails with a unique-violation
```

## Architecture references

- [`../../architecture/auth.md`](../../architecture/auth.md) § "Data model" and § "Row-Level Security" — authoritative DDL. Copy verbatim.
- [ADR-0019 — Multi-app architecture](../../architecture/adr/0019-multi-app-architecture.md) — explains `organizations.type` discriminator and why there's no `studios` table.
- [ADR-0016 — Onboarding data model revision](../../architecture/adr/0016-onboarding-data-model-revision.md) — `market` is free text (no CHECK), `studio_name` is gone. Structural decisions preserved; table naming superseded by ADR-0019.
- [ADR-0007 — Auth data model](../../architecture/adr/0007-auth-data-model.md) — original model. Data-model section is superseded by ADR-0019 but the *intent* (auth.uid() is authority, service role only in webhooks) stands.
- [ADR-0008 — ORM](../../architecture/adr/0008-orm.md) — migration tooling.

## Implementation notes

- **DDL location:** shared-auth package (per [ADR-0019](../../architecture/adr/0019-multi-app-architecture.md)) — likely `packages/auth/migrations/` or `packages/db/migrations/shared-auth/`. Verify with the Drizzle layout in the repo before starting.
- **Tables.** Use the exact DDL from `architecture/auth.md`:
  - `public.profiles` — PK = `auth.users.id`, `is_onboarded` is a `GENERATED ALWAYS … STORED` boolean off `onboarding_completed_at IS NOT NULL`. Also includes `has_visited_dashboard boolean NOT NULL DEFAULT false` — flipped to `true` by the `/projects` page on first render, used by TASK-ONB-06 to decide whether to show `/welcome`.
  - `public.organizations` — PK uuid, `type` CHECK in `('individual','studio','firm','team')`, `size` CHECK in `('solo','2_5','6_10','11_plus')`. **No UNIQUE on `name`** (duplicate names allowed).
  - `public.organization_members` — composite PK `(organization_id, user_id)`, `role` CHECK in `('owner','admin','member')` default `'owner'`.
  - `public.subscriptions` — `status` CHECK in `('active','past_due','canceled','incomplete','incomplete_expired')`, `stripe_customer_id` and `stripe_subscription_id` UNIQUE, `entitlements` jsonb default `'{}'::jsonb`. **`user_id` is UNIQUE** — encodes the one-subscription-per-user MVP invariant ([ADR-0017](../../architecture/adr/0017-subscription-ownership.md)) and is the conflict target the webhook's `onConflictDoUpdate` relies on ([TASK-BILL-05](../billing-subscription/TASK-BILL-05-stripe-webhook-handler.md)). **No `trial_ends_at` column** — Free is indefinite.
- **Trigger:** `handle_new_user()` `SECURITY DEFINER`, `search_path = public`, inserts `(id) VALUES (NEW.id)` into `profiles`. Attach as `AFTER INSERT ON auth.users FOR EACH ROW`.
- **Organization creation is *not* in the trigger** — deliberately. Org type depends on whether the onboarding studio step is completed or skipped, so Server Actions own that write (see onboarding group).
- **RLS** — enable on all four tables. Policies verbatim from `architecture/auth.md`:
  - `profiles`: self read, self update.
  - `organizations`: member read, admin/owner update.
  - `organization_members`: self read + sibling-member read via subquery. **INSERT policy:** `WITH CHECK (user_id = auth.uid())` — users may insert their own membership rows; Server Actions in the onboarding group rely on this. No user-facing UPDATE/DELETE policy.
  - `organizations`: member read, admin/owner update, plus an **INSERT policy allowing any authenticated user** (`WITH CHECK (auth.uid() IS NOT NULL)`) so the onboarding studio Server Action can create the user's first org without service-role. Pair this with the `organization_members` self-INSERT policy so an org is only reachable if the creator also links themselves as `owner`.
  - `subscriptions`: self read. **No user-facing write policy.** Stripe webhook writes with service-role.
- **Indexes** as listed in `architecture/auth.md` § Data model.
- **Types:** run `drizzle-kit generate` (or equivalent) and commit. TASK-AUTH-03 consumes these.

## Review notes

- **Trigger privilege.** `SECURITY DEFINER` + an explicit `SET search_path = public` is required to prevent search-path hijacking. Reject the PR if `search_path` is missing.
- **RLS enablement is not the same as RLS policies.** Confirm each table has `ENABLE ROW LEVEL SECURITY` **and** matching policies, and that there is no `FORCE ROW LEVEL SECURITY` that would also constrain service-role writes unintentionally.
- **No UNIQUE on `organizations.name`** — verify the migration doesn't accidentally add one from a prior draft.
- **`is_onboarded` is generated.** Reviewers sometimes try to "simplify" this into an app-side computed value. The invariant is that the column is GENERATED STORED so the middleware query in TASK-AUTH-04 can filter on it cheaply and correctly.
- **`stripe_*` uniques.** Both `stripe_customer_id` and `stripe_subscription_id` must be UNIQUE. Webhook idempotency depends on it.
- **Down migration.** If the ORM supports it, write a working `down`. For prod we never run it, but local devs reset constantly.
- **Single project.** Per [ADR-0021](../../architecture/adr/0021-single-supabase-project.md), all tables live in the same Supabase project — future app tables get **real** foreign keys to `auth.users.id` / `public.organizations.id` (not opaque UUIDs as the original ADR-0019 framing suggested).

## Test plan

- **Schema contract (integration):** insert into `auth.users` (via the admin API or a test helper), assert a `profiles` row exists with matching id.
- **RLS smoke:** seed two users + two orgs. Using a JWT for U1, run `SELECT` on all four tables and assert only U1's rows return. Using service-role, confirm all rows are visible.
- **Unique violation:** insert two `subscriptions` rows with the same `stripe_subscription_id` and assert the second fails.
- **Generated column:** `UPDATE profiles SET onboarding_completed_at = now()` → `SELECT is_onboarded` returns true without a second write.
- **Manual:** `\d+ public.profiles` in `psql` to eyeball the generated column and CHECKs.

## Open questions

- None. Org + member inserts use dedicated RLS policies (see Implementation notes); service-role is reserved for the Stripe webhook and ops scripts.
