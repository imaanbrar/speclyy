---
id: TASK-TEST-03
title: Onboarding E2E suite (Playwright)
group: testing
status: ready
estimate: 4
dependencies: [TASK-TEST-01, TASK-ONB-01, TASK-ONB-02, TASK-ONB-03, TASK-ONB-04, TASK-ONB-05, TASK-ONB-06]
related_screens: ["2.1", "2.2", "2.3", "2.4", "2.5"]
related_adrs: [ADR-0016, ADR-0019]
created: 2026-04-22
---

# TASK-TEST-03 — Onboarding E2E suite

## Goal

Once the Onboarding group is merged, cover the full 4-step Free path and the Skip/revisit permutations with Playwright on top of the harness from [TASK-TEST-01](TASK-TEST-01-playwright-harness.md). The Pro-checkout branch is covered by [TASK-TEST-04](TASK-TEST-04-billing-e2e-suite.md) to avoid duplication.

## Scope

**Specs under `e2e/onboarding/`**
- `shell.spec.ts`
  - Progress label is "Step X of 4" on each of the four routes.
  - Onboarded user hitting `/onboarding/*` is redirected to `/projects`.
  - Sign-out link in the footer works mid-onboarding.
- `step-1-name.spec.ts`
  - Happy path: first + last name → advance to `/onboarding/studio`, persisted on revisit.
  - Whitespace-only input rejected.
- `step-2-studio.spec.ts`
  - Save path: `organizations` row created with `type='studio'`, member row linked.
  - Skip path: `type='individual'`, name = `"{first} {last}"`, size `NULL`.
  - Revisit save-after-skip converts the individual row in place (no second org).
- `step-3-market.spec.ts`
  - Preset choice persists the snake_case value.
  - "Somewhere else" persists verbatim, trimmed.
  - Revisit re-selects the right card (preset vs free text).
- `step-4-plan-free.spec.ts`
  - Default-selected Free; "Continue with Free" sets `onboarding_completed_at`.
  - Bounces to `/welcome`.
  - Middleware now lets `/projects` through.
- `welcome.spec.ts`
  - First arrival shows primary + secondary CTAs.
  - Return visit after `/projects` redirects away (per first-visit signal from TASK-ONB-06).

**Fixtures added**
- `signedInPage({ onboarded: false })` variant that seeds a mid-onboarding user (no `first_name`, `last_name`, etc.).
- Helper `readOrgForUser(userId)` to assert org + member invariants directly against the DB.

**Out of scope**
- Pro path — covered in TASK-TEST-04.
- Visual review — manual.

## Acceptance criteria

```gherkin
Scenario: Suite passes on CI
  Given the onboarding group is merged to the test environment
  When the e2e workflow runs
  Then every spec in e2e/onboarding/ is green
  And the Free-path spec completes the entire 4-step flow and lands on /projects

Scenario: Invariant enforced
  Given a user completes onboarding on the Free path
  Then exactly one organization_members row exists for that user
  And the linked organizations row has type in ('studio','individual') consistent with the user's choices

Scenario: Isolation
  Given the suite runs against the test Supabase project
  Then no production row is touched
  And resetDb() guard asserts env != 'production'
```

## Architecture references

- [`../../implementation-tasks/onboarding/_source-plan.md`](../onboarding/_source-plan.md) — the authoritative Free / skip / save decisions this suite enforces.
- [`../../architecture/auth.md`](../../architecture/auth.md) § "Data model" — invariants the DB assertions pin.

## Implementation notes

- **Reuse `signedInPage`** from TASK-TEST-02 with an `onboarded: false` parameter. Do not re-seed auth state from scratch.
- **DB assertions via service-role fixture.** Readbacks of `organizations` / `organization_members` / `profiles` confirm invariants the UI alone can't prove.
- **Keep each spec independent.** Unique emails per test case; `resetDb()` at suite-start.
- **Timeouts.** Step transitions should complete in under 2s on the local webServer; cap per-scenario at 15s.

## Review notes

- **Happy-path enforcement of the invariant** is the most valuable check in this suite — if org creation is broken, nothing else in the app works right. Reviewers: confirm the invariant assertion exists in the Save spec AND the Skip spec.
- **Flake discipline.** Don't chain specs (spec A leaves state for spec B). Each spec owns its seeded user.
- **No Stripe interaction.** The Free path must not hit Stripe at all — confirm by not importing the Stripe fixture.

## Test plan

This task is the test plan for the Onboarding group. Self-verification:

- Run locally on a fresh clone; all specs green.
- Break-the-build: temporarily regress TASK-ONB-03 to skip member-row insert; confirm suite turns red with a clear error.

## Open questions

- None.
