---
id: TASK-TEST-01
title: Playwright harness + CI wiring
group: testing
status: ready
estimate: 3
dependencies: []
related_screens: []
related_adrs: []
created: 2026-04-22
---

# TASK-TEST-01 — Playwright harness + CI wiring

## Goal

Stand up a Playwright end-to-end test harness that every future per-group suite (auth, onboarding, billing, …) can plug into without re-inventing plumbing. Scope is infrastructure only — **no feature specs** ship in this task.

## Scope

**In scope**
- Install Playwright + browsers; pin the version.
- Project layout at `apps/web/tests/e2e/` (or `e2e/` at repo root — pick one in the PR and document it).
- `playwright.config.ts` with sensible defaults: Chromium for CI, WebKit + Firefox opt-in, parallel workers, retries on CI only, HTML reporter, trace on first retry, screenshot / video on failure.
- A `webServer` block that starts the Next.js dev server (or built server) against a **dedicated test environment** — either a `.env.test` pointing at a test Supabase project or a local Supabase branch.
- Fixtures directory with scaffolding files (empty or placeholder) for: `seedUser`, `resetDb`, `getOtpFromInbox`. No real implementation here — just the file skeletons so suite authors know where to plug in.
- Base test fixtures (`test.extend`) that auto-provision and tear down a seeded user, so per-feature specs stay short.
- GitHub Actions workflow `.github/workflows/e2e.yml` that:
  - Runs on PRs touching `apps/web/**`, `packages/**`, or `e2e/**`.
  - Installs deps, starts the app, runs Playwright, uploads the HTML report as an artifact on failure.
- Local scripts: `pnpm test:e2e`, `pnpm test:e2e:ui`, `pnpm test:e2e:headed`.
- A one-page `README.md` inside the `e2e/` directory explaining how to write a new spec + how to run locally.

**Out of scope**
- Any feature test spec — those live in per-group testing tasks (TASK-TEST-02, etc.).
- Visual regression tooling (Percy, Chromatic) — revisit post-MVP.
- Component tests — Vitest handles those in feature tasks.
- Load / performance tests.

## Acceptance criteria

```gherkin
Scenario: Local E2E run works cold
  Given a fresh clone of the repo
  And .env.test is populated with test-project secrets
  When I run "pnpm install" then "pnpm test:e2e"
  Then Playwright boots the app, runs zero-or-one smoke spec, and exits 0

Scenario: CI runs E2E on matching PRs
  Given I open a PR touching apps/web
  Then the e2e workflow runs on that PR
  And failure uploads the HTML report as an artifact

Scenario: Fixtures expose the expected surface
  Given a new spec file using the base fixture
  When the author writes test('...', async ({ signedInPage }) => ...)
  Then the type surface provides a logged-in page without custom boilerplate

Scenario: Test env isolation
  Given the harness is configured
  Then NEXT_PUBLIC_SUPABASE_URL in test points at a non-production project
  And running the suite never touches the production database
```

## Architecture references

- [`../../architecture/auth.md`](../../architecture/auth.md) § "Testing approach" — references Playwright for the sign-in flow.
- [ADR-0002 — Hosting platform](../../architecture/adr/0002-hosting-platform.md) — Vercel preview URLs are a future option for running E2E against preview deploys (out of scope here, but the harness should be compatible).

## Implementation notes

- **Pin versions.** Pin both `@playwright/test` and the browsers version in `package.json` and the CI step. Version drift between local and CI is a common flake source.
- **`webServer` config.**
  ```ts
  webServer: {
    command: 'pnpm --filter web dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    env: { NODE_ENV: 'test' },
  }
  ```
  On CI prefer `next start` against a pre-built app so first-request compilation doesn't blow the per-test timeout.
- **Test Supabase project.** Either stand up a new Supabase project `speclyy-test` (preferred — isolated) or use Supabase local dev branches. Secrets go into GitHub Actions secrets, not into the repo.
- **Fixture skeletons** (implementations land in TASK-TEST-02+):
  - `seedUser({ email, onboarded }): Promise<{ userId, email }>`
  - `resetDb(): Promise<void>` — truncates test-only rows; MUST be a no-op in prod (assert env).
  - `getOtpFromInbox(email): Promise<string>` — uses Supabase admin API to fetch the latest OTP.
- **Traces & screenshots.** `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`. Keeps artifacts small while still giving enough debug signal.
- **Retries.** `retries: process.env.CI ? 2 : 0`. Flaky tests hide bugs locally if retries are on; CI gets two shots to absorb network blips.
- **Parallel workers.** Default to 1 worker on CI until suite grows — cheaper than fighting flakes from shared DB state.

## Review notes

- **Prod isolation is the only non-negotiable.** Grep the final harness for any hardcoded prod URL; assert `resetDb()` guards with an env check.
- **Version pins.** `@playwright/test` pin + matching browsers pin in CI step.
- **No feature specs slip in.** This PR adds the harness and at most one smoke spec (e.g. "homepage renders"). Feature coverage is explicitly another task's job.
- **Secrets hygiene.** `.env.test.example` committed with placeholders; real `.env.test` in `.gitignore`.
- **CI artifact upload** must be conditional on failure to avoid 100MB uploads on green builds.
- **Timeouts.** Per-test default 30s; override only with a comment explaining why.

## Test plan

- **Self-test:** the harness's own single smoke spec (renders `/`) passes locally and on CI.
- **Manual:** run `pnpm test:e2e:ui`, confirm the UI mode launches and shows the smoke spec.
- **Manual:** force a failure (throw inside the smoke spec) — confirm HTML report + screenshot + trace upload on CI.
- **Manual:** grep the preview deploy's logs for any sign the E2E run hit it — must be zero.

## Open questions

- Run E2E against Vercel preview deploys or against the local `webServer`? Recommend: `webServer` for v1 — simpler, no preview-URL timing issues. Revisit when the suite matures.
- Separate Supabase test project vs local branch? Recommend: dedicated project for CI (stable), local branch for dev-machine runs.
