# ADR-0019: Multi-app architecture — shared auth project + `organizations` entity

- **Status:** Accepted
- **Date:** 2026-04-22
- **Supersedes:** the `studios` table naming in [ADR-0016](0016-onboarding-data-model-revision.md). Structural decisions from 0016 (first-class entity, no `UNIQUE(name)`, Skip auto-creates, invariant "every profile has an org") still hold — the table is just renamed and gains a `type` discriminator.

## Context

Speclyy is the first app, but the product vision includes additional apps under the same brand (`*.speclyy.com`). Two forces shape the data architecture before a second app exists:

1. **Shared identity.** A user signing into one app should not re-auth on another. Supabase cookies set on `.speclyy.com` give this for free, but only if both apps talk to the same Supabase project for auth.
2. **Shared account-level concepts.** Organizations (for Speclyy: "studios"; for a future firm-facing app: "firms"; for an internal tool: "teams") and subscriptions are account-level, not app-level. They belong wherever `auth.users` lives.

Naming `studios` today bakes a single-app assumption into the schema. Renaming later — after production data, RLS policies across many tables, and per-app code all reference `studios` — is the kind of migration that gets deferred indefinitely. Cost today: one table rename. Cost later: a migration project.

## Decision

### Project boundary

One Supabase project is the **shared auth project** and owns:

- `auth.users` (Supabase-managed)
- `public.profiles` — 1:1 with `auth.users`, app-agnostic identity
- `public.organizations` — account-level entity, typed per app
- `public.organization_members` — membership join table (supports future teammate invites)
- `public.subscriptions` — per-user subscriptions with app/plan entitlements

Each app gets its **own** Postgres database (may be its own Supabase project or an external DB) for app-specific data (projects, documents, app state). App databases reference `user_id` and `organization_id` as opaque UUIDs — no cross-database FKs. Apps verify Supabase JWTs on requests and trust `auth.uid()` / membership claims.

### Rename `studios` → `organizations` with a `type` discriminator

```sql
CREATE TABLE public.organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  type       text NOT NULL CHECK (type IN ('individual','studio','firm','team')),
  size       text CHECK (size IN ('solo','2_5','6_10','11_plus')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

`type` is open-ended by design — each app picks which values it supports. For Speclyy v1 only `'individual'` and `'studio'` are produced:

- User completes the studio step → `type = 'studio'`, `name = <studio name>`, `size = <selected>`.
- User skips the studio step → `type = 'individual'`, `name = "{first_name} {last_name}"`, `size = null`. UI labels this user as "Individual" rather than surfacing a studio. They can convert to a studio later from Settings (mutates `type` + `name` + optionally `size`).

The frontend keeps the word "Studio" in Speclyy's UI copy — `type` is a schema concern, not a UX one.

### Introduce `organization_members` from day one

```sql
CREATE TABLE public.organization_members (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('owner','admin','member')) DEFAULT 'owner',
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);
CREATE INDEX organization_members_user_id_idx ON public.organization_members (user_id);
```

At signup, a single `organization_members` row is created linking the profile to their org with `role = 'owner'`. Today that means 1:1 profile ↔ org; when invites ship it becomes 1:N with no schema change and no RLS policy rewrite.

`profiles.studio_id` is removed — membership is the source of truth. A profile's "current" org for Speclyy is derived by joining `organization_members` filtered to orgs with `type IN ('individual','studio')`.

### Subscriptions stay per-user with entitlements

[ADR-0017](0017-subscription-ownership.md) keeps its answer: `subscriptions.user_id`, one row per user. To support future bundle subscriptions (one sub unlocking multiple apps), add an `entitlements` column:

```sql
ALTER TABLE public.subscriptions
  ADD COLUMN entitlements jsonb NOT NULL DEFAULT '{}'::jsonb;
-- Shape: { "speclyy": { "plan": "pro" }, "<future-app>": { "plan": "starter" } }
```

Single-app and bundle subscriptions look identical to apps querying their entitlement — a single-app sub just has one key in the jsonb. Speclyy v1 writes `{"speclyy": {"plan": "pro"}}` when the Stripe webhook lands a paid subscription.

### Cookie domain

Supabase session cookies are set on `.speclyy.com` so any subdomain app (`app.speclyy.com`, future `<app2>.speclyy.com`) receives the session. The cookie domain is set by `@supabase/ssr` in our app code (`cookieOptions.domain`, env-gated to production) — not via the Supabase dashboard, which no longer exposes a cookie-domain field. Local dev stays on `localhost` (no domain attribute needed).

## Rationale

**Rename now, not later.** Zero production users, zero RLS-policy sprawl, zero app code that references `studios`. The rename is mechanical today and catastrophic after v1 traffic.

**Membership table from day one.** The 1:1 profile → org case is a special case of 1:N membership. Starting with membership means the teammate-invites feature is a pure feature addition — no schema migration, no RLS policy rewrite.

**`type` discriminator beats per-app tables.** A future firm app storing firms in a separate `firms` table would duplicate the membership/subscription/RLS machinery. One `organizations` table with `type` keeps all account-level code generic across apps.

**One shared Supabase project for auth/org/billing.** Split-project setups require SSO bridging between projects (non-trivial) or custom JWT verification. Single project = cookie works everywhere on `.speclyy.com`, one `auth.users` is canonical, RLS expressions stay simple.

**App DBs per app.** Keeps each app's data domain independent (schema evolution, backup/restore blast radius, RLS complexity). Cross-app reporting (if ever needed) is a data-warehouse concern, not a live-query concern.

**`entitlements` jsonb, not a join table.** A subscription row's entitlements are read on nearly every gated action. A jsonb column is read with the subscription in one fetch; a normalized `subscription_entitlements` table adds a join for no queryable benefit at current scale. Revisit if entitlement queries need to filter/aggregate across subscriptions.

## Consequences

**Positive**
- Second app is wiring + RLS policies, not a data migration.
- Teammate invites land as a feature, not a migration.
- `organizations.type` lets each app surface its own copy ("Studio", "Firm", "Team") without schema divergence.
- Bundle subscriptions are a Stripe-side pricing concern + entitlement write; no schema change.
- Individual users are modeled cleanly as `type = 'individual'`, not as "user without a studio."

**Negative**
- A little more machinery in v1 than strictly needed for one app: a membership table that's always 1-row, a `type` column with effectively two values, an `entitlements` column with one key. Accepted as the cost of not rewriting the schema later.
- Implementation-plan docs and any existing migrations referencing `studios` need a rename pass.
- "Org" in DB vs "Studio" in UI creates a small translation layer. Worth it — UI language shifts per app, schema naming cannot.

## Alternatives considered

- **Keep `studios`, rename only if/when a second app is built.** Rejected — the whole point of this ADR is avoiding that migration after users exist.
- **Per-app `studios` / `firms` / `teams` tables.** Rejected — duplicates membership, subscription linkage, and RLS per app.
- **Single Supabase project for everything (auth + all app data).** Rejected — app data domains benefit from isolation; also concentrates blast radius.
- **Split auth and org into two projects bridged by SSO.** Rejected — bridging complexity without near-term benefit.
- **Normalize entitlements into a join table from day one.** Rejected — jsonb is faster to read, zero migration cost to normalize later if needed.

## Migration (pre-production)

No production data exists. The change is a straight schema rewrite in the next migration:

1. `DROP TABLE public.studios` (if already created in dev).
2. `CREATE TABLE public.organizations` with `type` and `size`.
3. `CREATE TABLE public.organization_members`.
4. `ALTER TABLE public.profiles DROP COLUMN studio_id` (replaced by membership).
5. `ALTER TABLE public.subscriptions ADD COLUMN entitlements jsonb ...`.
6. Update `handle_new_user` trigger to create only the blank profile; organization creation is handled explicitly by the onboarding Server Actions (studio step or skip) since the org type depends on user choice.
7. Update RLS policies accordingly (see [`auth.md`](../auth.md) §Row-Level Security).

## References

- [ADR-0016](0016-onboarding-data-model-revision.md) — studios entity (table rename superseded here; structural decisions preserved)
- [ADR-0017](0017-subscription-ownership.md) — per-user subscriptions (unchanged; entitlements column is additive)
- [`../auth.md`](../auth.md) — updated schema, RLS, and project-boundary narrative
