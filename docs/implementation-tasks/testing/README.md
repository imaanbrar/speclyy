# Testing

**Goal.** Keep end-to-end (E2E) testing out of the critical path of feature work. Feature tasks ship with **unit tests + manual verification only**. Once a feature group is fully merged, a dedicated testing task stands up the Playwright suite for that group.

This prevents the common failure mode where half a team's PRs block on "E2E coverage" while the feature itself is ready — and where Playwright scaffolding gets re-invented six times because every feature task reaches for it.

## Rules

- **Feature tasks may include:**
  - Unit tests (Vitest / Jest) for pure functions and hooks.
  - Schema / RLS contract tests (direct DB).
  - Manual QA steps.
  - Type-check / build must pass.
- **Feature tasks may NOT include:**
  - Playwright specs. They land in the matching testing task.
  - New fixtures for an E2E harness that doesn't exist yet.
- **When is a testing task ready to pick up?** When every feature task in the corresponding group is merged and reachable in a preview deploy.

## Tasks

| ID | Title | Priority | Status | Est | Depends on |
|----|-------|----------|--------|-----|------------|
| [TASK-TEST-01](TASK-TEST-01-playwright-harness.md) | Playwright harness + CI wiring | P0 | 🔜 ready | 3 | — |
| [TASK-TEST-02](TASK-TEST-02-auth-e2e-suite.md) | Auth E2E suite (sign-in, OTP, callback, middleware, sign-out) | P0 | 🔜 ready | 5 | TASK-TEST-01, all of Auth group |
| [TASK-TEST-03](TASK-TEST-03-onboarding-e2e-suite.md) | Onboarding E2E suite (4-step Free path + Skip variants) | P0 | 🔜 ready | 4 | TASK-TEST-01, all of Onboarding group |
| [TASK-TEST-04](TASK-TEST-04-billing-e2e-suite.md) | Billing E2E suite (Pro purchase, webhooks, paywall, portal) | P0 | 🔜 ready | 5 | TASK-TEST-01, all of Billing group |
| (…) | Per-group suites land as their features ship | | | | |

## Conventions

- Playwright project lives at `apps/web/tests/e2e/` (or `e2e/` at repo root — decide in TASK-TEST-01).
- One spec file per feature-level concern, grouped by feature-task area: `auth/sign-in.spec.ts`, `auth/middleware.spec.ts`, etc.
- Spec files reference the originating feature task(s) in a header comment, e.g. `// Covers TASK-AUTH-05, TASK-AUTH-06`.
- A test Supabase project (shared with local dev or a dedicated `speclyy-test`) is used; never hit prod.
- Seed / reset helpers live in `e2e/fixtures/` and are reused across suites.

## What belongs in manual QA (not E2E)

- OAuth consent-screen visuals (Google controls this).
- Email inbox rendering across clients.
- Cookie-flag audits in DevTools.
- Cross-browser visual review.

Manual items stay in the feature task's "Test plan — Manual" list and do **not** migrate here.
