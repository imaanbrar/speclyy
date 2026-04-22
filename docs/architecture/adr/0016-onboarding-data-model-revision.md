# ADR-0016: Onboarding data model revision — studios entity + free-text market

- **Status:** Accepted — table renamed from `studios` to `organizations` by [ADR-0019](0019-multi-app-architecture.md); structural decisions (first-class entity, no `UNIQUE(name)`, Skip auto-creates, profile-has-org invariant) remain current.
- **Date:** 2026-04-22
- **Supersedes:** the data-model section of [ADR-0007](0007-auth-data-model.md). The middleware gate chain from ADR-0007 remains current.
- **Partially superseded by:** [ADR-0019](0019-multi-app-architecture.md) — `studios` is now `organizations` with a `type` discriminator, and membership lives in `organization_members` rather than `profiles.studio_id`.

## Context

[ADR-0007](0007-auth-data-model.md) stored studio as a `profiles.studio_name` string and constrained `profiles.market` with a four-value CHECK. The onboarding & billing design introduces two requirements that break both choices:

1. **Teammate invites** are a near-term roadmap item — multiple profiles must belong to one studio. A per-profile `studio_name` string cannot express that.
2. **Market "Somewhere else"** — the onboarding market step now offers a free-text city/region field alongside the four launch markets. The `CHECK (market IN (…))` constraint blocks that.

The studio step also now collects **studio size** (Just me / 2–5 / 6–10 / 11+), which belongs on the studio, not the profile.

## Decision

### Promote `studios` to a first-class table

```sql
CREATE TABLE public.studios (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  size       text CHECK (size IN ('solo','2_5','6_10','11_plus')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

No uniqueness on `name` — two studios may legitimately share a name.

### Amend `profiles`

```sql
ALTER TABLE public.profiles
  DROP COLUMN studio_name,
  ADD  COLUMN studio_id uuid REFERENCES public.studios(id) ON DELETE SET NULL,
  DROP CONSTRAINT profiles_market_check;
-- market stays as free text. Canonical launch values are produced by the UI;
-- "Somewhere else" stores whatever the user typed.
```

### Invariant: every profile has a studio

The studio step offers a **Skip** action. Skip auto-creates a studio named `"{first_name} {last_name}"` (null size) and links it. No profile finishes onboarding without a `studio_id`. This makes downstream joins (project ownership, future team invites) unconditional.

### RLS

`studios` enables RLS. Baseline policies:

```sql
ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "studios: member read" ON public.studios
  FOR SELECT USING (
    id IN (SELECT studio_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "studios: member update" ON public.studios
  FOR UPDATE USING (
    id IN (SELECT studio_id FROM public.profiles WHERE id = auth.uid())
  );
```

INSERT is performed by Server Actions; no user-facing INSERT policy needed.

## Rationale

**Separate table, not a JSON column.** Studios will grow fields (logo, letterhead config, invite tokens) and join to projects and invites. A real table pays for itself on the first join.

**No `UNIQUE(name)`.** Two designers in different cities can genuinely have the same studio name. Uniqueness would force artificial disambiguation UX. If teammate-invites ever need dedupe, an invite flow (rather than name matching) is the right mechanism.

**Free-text `market`.** The curated launch markets (`los_angeles`, `new_york`, `dallas`, `calgary`) are an operational concern — which showrooms we've indexed — not a schema invariant. Storing free text lets the design ship "Somewhere else" today without migration; the Library query filters by canonical values and falls back to generic search for anything else.

**Skip auto-creates a studio instead of leaving `studio_id` null.** Nullable `studio_id` means every downstream query needs a null-branch. Auto-creating the studio preserves the invariant "profile → studio" and costs nothing — the user can rename later from Settings.

## Consequences

**Positive**
- Teammate invites land as a pure feature, no schema migration.
- "Somewhere else" markets unblocked without schema churn later.
- Studio-level settings (letterhead, logo) have an obvious home.
- All queries `profiles JOIN studios` are unconditional.

**Negative**
- Onboarding now writes two tables (`profiles` update, `studios` insert) instead of one. Acceptable — both are single-row writes on the same connection.
- Naming duplicates are possible by design. UI should display enough context (e.g. owner name) when it lists studios.
- Free-text `market` means application code must treat it as untrusted for any branching — always match against a canonical list or fall through.

## Alternatives considered

- **Keep `profiles.studio_name` until invites ship** — Rejected. Migrating a per-user string into a relational entity after production data exists is the kind of migration that gets deferred indefinitely.
- **`studios` table with `UNIQUE(name)`** — Rejected. Forces artificial disambiguation on sign-up; no real benefit in v1.
- **Keep market CHECK and add `market_custom text`** — Rejected. Two columns expressing one concept invites drift; the CHECK constraint carried no real validation value.
- **Enum type for market instead of CHECK** — Rejected for the same reason plus migration cost when new launch markets are added.

## References

- [ADR-0007](0007-auth-data-model.md) — auth data model + middleware gates (data-model section superseded)
- [`../auth.md`](../auth.md) — updated narrative
- [`../../implementation-plans/onboarding.md`](../../implementation-plans/onboarding.md)
