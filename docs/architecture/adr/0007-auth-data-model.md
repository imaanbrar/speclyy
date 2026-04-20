# ADR-0007: Auth data model and middleware gates

- **Status:** Accepted
- **Date:** 2026-04-20

## Context

Supabase Auth manages the `auth.users` table (id, email, OAuth identities, timestamps). This schema is Supabase-owned — we should not add application-specific columns.

Speclyy needs additional user data:
- **Profile fields** — first name, last name, studio name, market (per onboarding 2.1–2.3)
- **Onboarding state** — whether the user has completed onboarding (and when)
- **Subscription state** — trial status, Stripe IDs, plan status, promo code applied

And middleware-enforced gates for:
- Unauthenticated → sign-in
- Authenticated but not onboarded → onboarding flow
- Authenticated + onboarded but trial expired / subscription lapsed → billing

## Decision

### Data model

Two tables in the `public` schema:

```sql
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  studio_name text,
  market text CHECK (market IN ('los_angeles', 'new_york', 'dallas', 'calgary')),
  onboarding_completed_at timestamptz,
  is_onboarded boolean GENERATED ALWAYS AS (onboarding_completed_at IS NOT NULL) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profiles_is_onboarded_idx ON public.profiles (is_onboarded);

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN (
    'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired'
  )),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  promo_code_id uuid,  -- FK added in later ADR when promo_codes modeled
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_user_id_idx ON public.subscriptions (user_id);
```

A Postgres `AFTER INSERT` trigger on `auth.users` creates the matching `profiles` row.

### Middleware gate chain

```
Request → middleware.ts
  1. Refresh session (supabase.auth.getUser())
  2. If unauthenticated AND path not public      → redirect /sign-in
  3. If authenticated AND !is_onboarded AND
     path not in /onboarding/* or /sign-out      → redirect /onboarding/name
  4. If trial expired OR subscription lapsed
     AND path not in /billing/* or /sign-out     → redirect /billing
  5. Pass through
```

Public paths (no gate): `/`, `/sign-in`, `/auth/callback`, `/privacy`, `/terms`, API webhooks.

## Rationale

**Split `profiles` and `subscriptions`.** Stripe webhooks mutate subscription state independently of profile data. Combining them would mean every webhook touches profile rows. Separate tables give cleaner webhook handlers, smaller blast radius on bugs, and room for future subscription history (trial extensions, plan changes, promo audit).

**Generated `is_onboarded` column.** We write only `onboarding_completed_at`; Postgres derives the boolean. The two fields cannot drift. Makes middleware conditions (`WHERE is_onboarded = false`) clean and indexable.

**Profile row via DB trigger, not application code.** Running the insert inside an `AFTER INSERT` trigger on `auth.users` guarantees every auth user has a matching profile — no race conditions, no defensive "profile not found" code paths in the app.

**Gate order optimized for the common case.** Unauth check is cheapest and mandatory for the rest to make sense. Onboarding check is next-most-common redirect. Trial check last because most users are in good standing. Order minimizes work on the hot path.

**Onboarding and billing paths bypass later gates.** Otherwise trial-expired users couldn't reach `/billing` to pay, and unfinished-onboarding users couldn't reach `/onboarding/*`. `/sign-out` always bypasses.

## Consequences

**Positive**
- `auth.users` stays Supabase-owned and untouched.
- Generated column prevents onboarding-state drift between boolean and timestamp.
- Stripe webhook handler has a narrow blast radius — touches `subscriptions` only.
- Gate chain is one function, readable and debuggable.
- RLS policies on `projects`, `groups`, `items` reference `profiles.id` (= `auth.uid()`) cleanly.

**Negative**
- Reads needing profile + subscription state require a join. Acceptable — RSC caches the one query per request.
- Middleware runs two DB reads (profile, subscription) on every authenticated request. Mitigation: promote `is_onboarded` and subscription `status` into the JWT as custom claims, refreshed on change — defer as an optimization ADR if latency ever becomes a concern.
- Trigger-created profile rows mean application code cannot test the "no profile" path in isolation — the trigger is the only creator. We treat this as a schema invariant.

## Alternatives considered

- **Single `users` table combining profile + subscription** — Rejected. Conflates concerns; Stripe webhooks would write profile columns; no room for subscription history.
- **Boolean-only `is_onboarded` column, no timestamp** — Rejected. Loses audit information; schema migrations to add it later cost data.
- **Timestamp-only, no boolean** — Workable but middleware/RLS checks read slightly less clearly; the generated column gives both with zero drift risk.
- **Subscription state as JWT claims only (no table)** — Rejected. Claims go stale until refresh; Stripe webhooks need a durable target; history queries impossible.
- **Separate middleware files per gate** — Rejected. Next.js has one `middleware.ts`; the gate chain is one function with helper calls.

## References

- [ADR-0004 — Postgres host: Supabase](0004-postgres-host.md)
- [ADR-0005 — Auth provider: Supabase Auth](0005-auth-provider.md)
- [ADR-0006 — Session strategy: cookie SSR](0006-session-strategy.md)
- [`../auth.md`](../auth.md) — narrative end-to-end walkthrough
