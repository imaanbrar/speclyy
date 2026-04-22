---
id: US-101
title: Sign in with Google
epic: epic-01-auth-onboarding
persona: prospect
priority: P0
status: ready
estimate: 3
dependencies: []
related_screens: ["1.1 Sign-In"]
related_adrs: [ADR-0005, ADR-0006, ADR-0007]
created: 2026-04-22
---

# US-101 — Sign in with Google

## Story

**As a** prospective interior designer evaluating Speclyy
**I want to** sign in with my Google account
**So that** I can start building specs without managing yet another password.

## Context

Google OAuth is the **only** sign-in method for MVP ([`mvp-decisions.md`](../../mvp-decisions.md) § 1). First-time sign-in routes to the 4-step onboarding (US-102 → US-105). Returning, onboarded users land on `/projects`. Free plan is granted automatically on first sign-in; **no payment is collected at this stage** ([`mvp-decisions.md`](../../mvp-decisions.md) § 10 — Free is indefinite, paywall fires only on PDF export).

A collapsed promo code field on the sign-in screen lets community partnerships and influencer campaigns hand out time-limited Pro grants ([`mvp-decisions.md`](../../mvp-decisions.md) § 4).

## Acceptance criteria

```gherkin
Scenario: First-time user signs in successfully
  Given I am an unauthenticated visitor on /sign-in
  When I click "Continue with Google"
    And I authenticate as a Google account that has never used Speclyy
  Then a record is created in auth.users via Supabase Auth
    And the AFTER INSERT trigger on auth.users creates a matching profiles row
    And the profiles row is populated with my Google email
    And the profiles.onboarding_completed_at is NULL (so is_onboarded = false)
    And session cookies are set: httpOnly, Secure, SameSite=Lax
    And I am redirected to /onboarding/name

Scenario: Returning, fully-onboarded user signs in
  Given I have a profiles row with onboarding_completed_at IS NOT NULL
  When I authenticate with my existing Google account
  Then I am redirected to /projects
    And no onboarding screens are shown

Scenario: Returning user who did not finish onboarding signs in
  Given I have a profiles row with onboarding_completed_at IS NULL
  When I authenticate with my existing Google account
  Then I am redirected to /onboarding/name
    And my partial onboarding state is preserved

Scenario: User cancels Google OAuth consent
  Given I click "Continue with Google"
  When I deny consent on the Google consent screen
  Then I am returned to /sign-in
    And an inline, non-blocking error message is shown above the button
    And no auth.users or profiles record is created

Scenario: User applies a valid promo code at sign-in
  Given I expand the promo code field and enter a valid, unredeemed code
  When I successfully authenticate with Google for the first time
  Then a profiles row is created
    And a subscriptions row is created with status='active' and current_period_end set per the promo grant
    And I am still routed to /onboarding/name (the plan overview at US-105 will reflect Pro status)

Scenario: User attempts to access a gated route while unauthenticated
  Given I have no session cookie
  When I request /projects directly
  Then middleware redirects me to /sign-in?next=/projects
    And after successful sign-in I am sent to /projects (unless onboarding redirects me first)
```

## UX notes

- Screen: [`../../screen-inventory.md`](../../screen-inventory.md) § 1.1 Sign-In.
- Single primary CTA: **"Continue with Google"**. No email/password fallback ([`mvp-decisions.md`](../../mvp-decisions.md) § 1).
- Promo code field: collapsed by default, expands inline; not a full second screen.
- Error states render inline above the button — never a full-page error.
- Speclyy logo + tagline above the CTA.

## Technical notes

- **Auth provider:** Supabase Auth / GoTrue with Google OAuth ([ADR-0005](../../architecture/adr/0005-auth-provider.md)).
- **Session strategy:** cookie-based JWT via `@supabase/ssr` — `httpOnly`, `Secure`, `SameSite=Lax` ([ADR-0006](../../architecture/adr/0006-session-strategy.md)). Three client factories: `createBrowserClient()` for the sign-in button, `createServerClient()` in `middleware.ts` for the post-callback redirect.
- **OAuth callback route:** `/auth/callback` — public route ([ADR-0007 § Public paths](../../architecture/adr/0007-auth-data-model.md)).
- **Profile creation:** AFTER INSERT trigger on `auth.users` writes to `public.profiles` ([ADR-0007](../../architecture/adr/0007-auth-data-model.md)) — application code does **not** insert profiles directly.
- **Middleware gate chain** ([ADR-0007](../../architecture/adr/0007-auth-data-model.md)):
  1. unauthenticated AND non-public path → `/sign-in`
  2. authenticated AND `is_onboarded=false` AND not in `/onboarding/*` or `/sign-out` → `/onboarding/name`
  3. (Trial gate is NOT wired — Free is indefinite per current `mvp-decisions.md`.)
- **Promo redemption:** Server Action `/api/promo/redeem`. Idempotent on `(user_id, promo_code_id)`.

## Test plan

- **E2E (Playwright):** new-user happy path → lands on `/onboarding/name`; session cookie set with correct flags.
- **E2E:** returning, onboarded user → lands on `/projects`.
- **E2E:** returning, unfinished-onboarding user → lands on `/onboarding/name`.
- **E2E:** unauthenticated request to `/projects` → redirected to `/sign-in?next=/projects`.
- **Unit:** middleware gate function — table-test all permutations of (auth, is_onboarded, path).
- **Unit:** promo code redemption is idempotent — calling twice with the same `(user_id, code)` yields one subscription row.
- **Manual:** revoke OAuth consent on the Google screen; confirm inline non-blocking error appears.
- **Manual:** verify cookie flags in browser DevTools (`httpOnly`, `Secure`, `SameSite=Lax`).
- **Manual:** silent session refresh — wait until access token expires, navigate, confirm new `Set-Cookie` header is issued (per [ADR-0006](../../architecture/adr/0006-session-strategy.md)).

## Out of scope

- Email/password, magic links, Apple SSO, Microsoft SSO ([`mvp-decisions.md`](../../mvp-decisions.md) § 1 — single sign-in method).
- Account merging across providers (post-MVP).
- Organization / team accounts — see [`../../roadmap.md`](../../roadmap.md) v2+.
- "Why Google only?" tooltip / explainer — defer until support asks for it.

## Open questions

- Should `next` query parameters be allow-listed to internal paths only? (Open redirects are a known phishing vector.) Recommend: yes, validate `next` starts with `/` and isn't `//evil.com`.
