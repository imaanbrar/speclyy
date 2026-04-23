---
id: TASK-TEST-02
title: Auth E2E suite (Playwright)
group: testing
status: ready
estimate: 5
dependencies: [TASK-TEST-01, TASK-AUTH-01, TASK-AUTH-02, TASK-AUTH-03, TASK-AUTH-04, TASK-AUTH-05, TASK-AUTH-06, TASK-AUTH-07, TASK-AUTH-08]
related_screens: ["1.1 Sign-In", "1.2 Sign-In · Verify"]
related_adrs: [ADR-0005, ADR-0006, ADR-0007]
created: 2026-04-22
---

# TASK-TEST-02 — Auth E2E suite

## Goal

Once the Auth group (TASK-AUTH-01 … -08) is merged, stand up the Playwright E2E coverage for every auth surface on top of the harness from TASK-TEST-01. Lands as one coherent suite so the entire auth flow is exercised the same way in every run.

## Scope

**In scope — specs under `e2e/auth/`**
- `sign-in.spec.ts`
  - `/sign-in` renders both Google and email CTAs.
  - Submitting email → navigates to `/sign-in/verify?email=…`.
  - Google CTA navigates to an `accounts.google.com` URL (intercepted, not followed).
  - Inline error renders when `?error=oauth_denied`.
  - `?next=%2Fprojects%2F123` is preserved into the `redirectTo` / navigation.
  - `?next=//evil.com` is dropped.
- `otp-verify.spec.ts`
  - End-to-end: request OTP → read code via `getOtpFromInbox` fixture → submit → lands on onboarding/project route per state.
  - Wrong code → inline error, input cleared.
  - Resend cooldown — button disabled with countdown after click.
  - `/sign-in/verify` without `?email=` redirects to `/sign-in`.
- `callback.spec.ts`
  - Successful callback for a new user → `/onboarding/name`.
  - Successful callback for an onboarded user, no `next` → `/projects`.
  - Successful callback for an onboarded user with valid `next` → that path.
  - `?next=//evil.com` is rejected, falls to `/projects`.
  - `?error=access_denied` → `/sign-in?error=oauth_denied`.
  - `?code=invalid` → `/sign-in?error=oauth_failed`.
- `middleware.spec.ts`
  - Unauthenticated `/projects` → `/sign-in?next=%2Fprojects`.
  - After sign-in with `next`, lands on the original target (onboarded user).
  - Unfinished-onboarding user → every gated path redirects to `/onboarding/name`.
  - Onboarded user hitting `/onboarding/*` → `/projects`.
  - Silent refresh — with a short-lived access token, navigation succeeds and a fresh `Set-Cookie` header is observed on the response.
- `sign-out.spec.ts`
  - Sign-out from header menu clears `sb-*` cookies and lands on `/sign-in`.
  - After sign-out, `/projects` redirects to `/sign-in?next=%2Fprojects`.
  - Sign-out works mid-onboarding; next sign-in resumes at `/onboarding/name`.
  - `GET /auth/sign-out` returns 405.
  - Double sign-out (race) — both tabs end on `/sign-in`.

**Fixtures to implement (stubbed in TASK-TEST-01)**
- `seedUser({ email, onboarded }: { email: string; onboarded: boolean })` — creates `auth.users` + sets `profiles.onboarding_completed_at` when `onboarded: true`.
- `resetDb()` — truncates test-only users / orgs / subscriptions. Guarded by env assertion.
- `getOtpFromInbox(email)` — calls Supabase admin API to pull the latest OTP token for the email.
- `signedInPage` base fixture — seeds a user, programmatically sets the session cookie (via `supabase.auth.admin.generateLink` or direct JWT), hands back a `Page` already authenticated. This avoids real OAuth round-trips for most tests.

**Out of scope**
- Google OAuth consent happy path in CI — Google's consent screen is brittle and rate-limited. Cover it with a single **manual** QA item referenced from TASK-AUTH-01 / TASK-AUTH-05 rather than here.
- Real email inbox verification — use Supabase admin API, not IMAP.
- Visual regressions — out of scope until a Chromatic/Percy decision lands.

## Acceptance criteria

```gherkin
Scenario: Suite is green on CI
  Given the auth group is merged and deployed to the test environment
  When the e2e.yml workflow runs
  Then every spec in e2e/auth/ passes
  And the run completes in under 5 minutes on the standard runner

Scenario: Fixtures are reused
  Given any new spec in e2e/auth/
  When the spec uses seedUser or signedInPage
  Then no per-spec DB plumbing is required

Scenario: Prod isolation enforced
  Given the suite is configured
  Then all specs hit the test Supabase project only
  And resetDb() asserts env !== 'production' before running

Scenario: Flake budget
  Given a rolling 20-run window on main
  Then the suite flakes on less than 2% of runs
  And any spec exceeding that threshold is quarantined (test.skip with a tracking issue)
```

## Architecture references

- [`../../architecture/auth.md`](../../architecture/auth.md) § "Testing approach" — the behaviors called out there are the contract this suite enforces.
- [ADR-0006 — Session strategy](../../architecture/adr/0006-session-strategy.md) — silent-refresh scenario specifics.
- [ADR-0007 — Auth data model](../../architecture/adr/0007-auth-data-model.md) — gate chain the middleware spec exercises.

## Implementation notes

- **Session seeding without real OAuth.** Use `supabase.auth.admin.createUser()` + `admin.generateLink({ type: 'magiclink' })` to mint a cookie without hitting Google. Store cookies on the Playwright `context`.
- **OTP fixture.** Supabase Admin API has no "get last OTP" endpoint; read it via the test DB (`auth.one_time_tokens` table, service-role query) or via the dev-only email inbucket. Document the chosen mechanism in the fixture's docblock.
- **Silent-refresh spec.** Set `JWT expiry` on the test Supabase project to a low value (e.g. 60s) *or* backdate the access token in a seeded cookie. The latter avoids per-run dashboard config.
- **Middleware spec** exercises real middleware by making real requests — no need to stub. Use `request` (APIRequestContext) for HEAD / redirect assertions to avoid page-load overhead.
- **Flake discipline.** Each spec must be independent — reset or namespace DB state. Prefer unique emails per spec (`e2e-${test.info().testId}@speclyy.test`) over shared fixtures.

## Review notes

- **Resetting prod is a catastrophic outcome.** Reviewers: assert that `resetDb()` has an explicit `if (!process.env.E2E_TEST_DB_URL?.includes('test')) throw` guard. The check is ugly but necessary.
- **No real Google OAuth in CI.** If a spec navigates to `accounts.google.com`, review it — we intercept, we don't follow.
- **Per-spec isolation.** Each spec should be runnable alone (`npx playwright test auth/middleware.spec.ts`) and not depend on sibling specs running first.
- **Service-role usage.** Fixtures need service-role for seeding. Confirm the key is only referenced in `e2e/fixtures/**` — never inside spec files.
- **Cookie assertions.** Validate cookie flags (`HttpOnly`, `Secure`, `SameSite=Lax`) in at least one spec per auth surface so regressions in `@supabase/ssr` behavior are caught.
- **Spec size.** If a spec file exceeds ~200 lines, split it. Auth has a lot of edges; readability matters.

## Test plan

This task **is** the test plan for the auth group. Its own verification:

- **Self-verification:** run the suite locally on a fresh clone. All specs green.
- **CI run:** green on the PR that introduces the suite.
- **Break-the-build check:** on a scratch branch, revert one feature task (e.g. remove the `?next=//evil.com` sanitization) and confirm the matching spec turns red.

## Open questions

- Do we gate merges on E2E green, or on unit + typecheck only with E2E as a required post-merge check? Recommend: required pre-merge on `main` once the flake rate is proven < 2%. Until then, post-merge + Slack notification on failure.
