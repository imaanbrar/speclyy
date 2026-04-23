---
id: TASK-ONB-06
title: Free Welcome screen
group: onboarding
status: ready
estimate: 1
dependencies: [TASK-ONB-05]
related_screens: ["2.5 Onboarding · Free Welcome"]
related_adrs: []
created: 2026-04-22
---

# TASK-ONB-06 — Free Welcome screen

## Goal

Post-Free-completion landing screen that bridges onboarding and the empty-state dashboard. Celebrates the account and hands the user into their first project creation flow.

## Scope

**In scope**
- Route: `apps/web/src/app/(onboarding)/welcome/page.tsx` (inside the onboarding route group, but the layout's "redirect onboarded users" guard is relaxed here — see Implementation notes).
- Copy: short welcome line + value prop recap.
- Primary CTA: **"Start your first project"** → `/projects/new`.
- Secondary action (quiet): **"Skip to dashboard"** → `/projects`.
- Reachable only when `onboarding_completed_at IS NOT NULL` AND the user has never visited `/projects` before — otherwise redirect to `/projects` (avoid bouncing returning users into a welcome screen).

**Out of scope**
- The `/projects/new` flow itself — separate group.
- Confetti / animations — product can revisit post-MVP.
- Pro Success screen — TASK-BILL-06.

## Acceptance criteria

```gherkin
Scenario: First arrival after Free completion
  Given I just completed onboarding on the Free plan
  When /onboarding/plan redirects me to /welcome
  Then the welcome screen renders with "Start your first project" and "Skip to dashboard"

Scenario: Returning visit is not re-shown
  Given I have already visited /projects at least once
  When I navigate directly to /welcome
  Then I am redirected to /projects

Scenario: CTA → new project
  Given I am on the welcome screen
  When I click "Start your first project"
  Then I land on /projects/new

Scenario: Secondary → dashboard
  When I click "Skip to dashboard"
  Then I land on /projects

Scenario: Unauthenticated access is blocked
  Given I have no session
  When I request /welcome
  Then middleware redirects me to /sign-in (standard gate)
```

## Architecture references

- [`../../implementation-tasks/onboarding/_source-plan.md`](_source-plan.md) § "Tasks · Billing · Free Welcome screen".
- [`../../screen-inventory.md`](../../screen-inventory.md) § 2.5.

## Implementation notes

- **Layout exception.** The onboarding layout from TASK-ONB-01 redirects onboarded users to `/projects`. `/welcome` is technically onboarded, so either:
  1. Move `/welcome` out of the `(onboarding)` route group into its own `(welcome)` group with a minimal layout.
  2. Keep it inside `(onboarding)` and special-case the path in the layout check.

  Prefer **option 1** — simpler, cleaner boundary. Copy the shell's logo/footer into the welcome layout without the progress component.
- **"Has the user visited `/projects` before?"** Track with a `profiles.has_visited_dashboard boolean NOT NULL DEFAULT false` column (decided) set to `true` by the `/projects` page on first render. Add the column to the initial `profiles` schema in [TASK-AUTH-02](../auth/TASK-AUTH-02-db-migration-auth-tables.md) — the DB is greenfield, so no separate follow-up is needed.
- **No DB writes on this screen** other than the flag above (and only when arriving; the flag itself is set by `/projects`, not here).

## Review notes

- **First-visit signal is a column**, not a cookie. Confirm `profiles.has_visited_dashboard` made it into TASK-AUTH-02's initial schema before merging this.
- **Don't make `/welcome` feel like a billing upsell.** The product decision is "Free is indefinite"; no "Upgrade to Pro" nudge here.
- **Reachability from Pro path.** `/welcome` is Free-only. The Pro path lands on `/billing/success` (TASK-BILL-06). Confirm the navigation tree enforces that.
- **Copy length.** Two short sentences. Longer welcome copy drifts stale and adds maintenance.

## Test plan

- **Unit:** `/projects` page action sets `has_visited_dashboard = true` exactly once (no-op on subsequent renders).
- **Manual:** complete onboarding on Free → land on `/welcome` → click primary → `/projects/new`.
- **Manual:** revisit `/welcome` after visiting `/projects` → redirect to `/projects`.
- **E2E coverage** ships in [TASK-TEST-03](../testing/TASK-TEST-03-onboarding-e2e-suite.md).

## Open questions

- None. First-visit signal is a `profiles.has_visited_dashboard` column added in the initial schema (TASK-AUTH-02).
