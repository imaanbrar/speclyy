# Onboarding

**Goal.** Take an authenticated user from first sign-in to "ready to create their first project" in four steps: Name → Studio → Market → Plan. On completion, `profiles.onboarding_completed_at` is set, an `organizations` row is created (type `studio` or `individual`), and the user lands on a Free Welcome screen or the Pro checkout (billing group).

**Outcome.** The middleware gate from [TASK-AUTH-04](../auth/TASK-AUTH-04-middleware-gates.md) flips from "must onboard" to "full app access" for every new user. The Pro branch hands off to the billing group without leaving the app's domain.

## Tasks

| ID | Title | Priority | Status | Est | Depends on |
|----|-------|----------|--------|-----|------------|
| [TASK-ONB-01](TASK-ONB-01-onboarding-shell.md) | Onboarding layout, progress shell, defensive profile upsert | P0 | 🔜 ready | 2 | Auth group |
| [TASK-ONB-02](TASK-ONB-02-step-1-name.md) | Step 1 · Name (first/last + "Signed in as") | P0 | 🔜 ready | 2 | TASK-ONB-01 |
| [TASK-ONB-03](TASK-ONB-03-step-2-studio.md) | Step 2 · Studio (organization + size + Skip) | P0 | 🔜 ready | 3 | TASK-ONB-02 |
| [TASK-ONB-04](TASK-ONB-04-step-3-market.md) | Step 3 · Market (IP-detected city + global search) | P0 | 🔜 ready | 2 | TASK-ONB-03 |
| [TASK-ONB-05](TASK-ONB-05-step-4-plan.md) | Step 4 · Plan (Free / Pro select + completion) | P0 | 🔜 ready | 3 | TASK-ONB-04, TASK-BILL-03 |
| [TASK-ONB-06](TASK-ONB-06-free-welcome.md) | Free Welcome screen | P0 | 🔜 ready | 1 | TASK-ONB-05 |

**Total estimate:** 13 points.

**E2E coverage** ships separately in [TASK-TEST-03 — Onboarding E2E suite](../testing/TASK-TEST-03-onboarding-e2e-suite.md).

## Source documents

- [`../../implementation-tasks/onboarding/_source-plan.md`](_source-plan.md) — **authoritative for confirmed decisions** (studio size, free-text market, skip behavior, progress label, subscription ownership).
- [`../../mvp-decisions.md`](../../mvp-decisions.md) § 10 (4-screen onboarding; Free indefinite).
- [`../../architecture/auth.md`](../../architecture/auth.md) § "Data model" — `profiles`, `organizations`, `organization_members`, trigger.
- [`../../screen-inventory.md`](../../screen-inventory.md) § 2.1–2.4.
- [`../../user-flows.md`](../../user-flows.md) — "Supporting Flow — First-time setup".

## Architecture references

- [ADR-0016 — Onboarding data model revision](../../architecture/adr/0016-onboarding-data-model-revision.md) (structural decisions; table naming superseded; market picker UX superseded).
- [ADR-0019 — Multi-app architecture](../../architecture/adr/0019-multi-app-architecture.md) — `organizations.type` discriminator, UI copy "Studio" vs schema `organization`.
- [ADR-0020 — Onboarding market: global city search](../../architecture/adr/0020-onboarding-market-global-cities.md) — TASK-ONB-04 picker design (IP detection + Open-Meteo).
- [ADR-0007 — Auth data model](../../architecture/adr/0007-auth-data-model.md) — middleware gate semantics.

## Invariants

- **Every completed-onboarding profile has exactly one `organization_members` row.** The studio step creates an `organizations` row with `type='studio'`; Skip creates one with `type='individual'` named `"{first_name} {last_name}"`. Either way the profile is linked via `organization_members` with `role='owner'`. See [`../../architecture/auth.md`](../../architecture/auth.md) § "Data model".
- **Progress label is "Step X of 4"** on every step (the Figma design shows "of 3" on 1–3 — override).
- **Plan step is informational-for-Free.** Choosing Free completes onboarding; choosing Pro hands off to the billing checkout and completion happens on the billing success screen.
- **No trial.** Free plan is indefinite. Paywalls are action-level (PDF export).

## Unblocks

- **Every feature group** — the middleware gate stops redirecting to `/onboarding/*` once `onboarding_completed_at` is set.
- **Billing checkout** — depends on TASK-ONB-05 being the entry point to Pro.
- **Account Settings** — edits the same `profiles` / `organizations` rows populated here.

## Cross-cutting notes for implementers

- **Server Actions own writes.** Client Components call Server Actions; no direct Supabase writes from the browser. The organization-creation Server Actions need either a dedicated `INSERT` RLS policy (checking `auth.uid() = user_id`) or must run as service-role. Decide in TASK-ONB-03; whichever path is chosen, document it there so billing follows the same pattern.
- **Profile upsert is defensive** in TASK-ONB-01 but shouldn't be load-bearing — the `handle_new_user` trigger from [TASK-AUTH-02](../auth/TASK-AUTH-02-db-migration-auth-tables.md) is the source of truth. Treat the upsert as belt-and-braces.
- **UI copy uses "Studio"**; schema is `organizations`. Keep the term "organization" out of user-facing strings.
- **All four step pages live under** `apps/web/src/app/(onboarding)/onboarding/<step>/page.tsx`. The route group shares the layout from TASK-ONB-01.
