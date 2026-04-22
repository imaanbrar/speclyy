---
id: US-107
title: Sign out
epic: epic-01-auth-onboarding
persona: designer
priority: P0
status: draft
estimate: 1
dependencies: [US-101]
related_screens: ["1.1 Sign-In", "3.1 Projects List"]
related_adrs: [ADR-0006, ADR-0007]
created: 2026-04-22
---

# US-107 — Sign out

## Story

**As a** signed-in designer
**I want to** sign out of Speclyy
**So that** I can leave my session on a shared device, switch Google accounts, or simply end my work.

## Context

Sign-out is a baseline auth requirement — not a flashy feature, but necessary for any auth UX. It must clear all session cookies, invalidate the refresh token at Supabase, and route the user to the sign-in screen. Unlike the other Epic 1 stories, sign-out has no dedicated screen in [`screen-inventory.md`](../../screen-inventory.md); it's an action triggered from the account menu in the dashboard header.

## Acceptance criteria

```gherkin
Scenario: Designer signs out from the account menu
  Given I am signed in and on /projects
  When I open the account menu in the header
    And I click "Sign out"
  Then session cookies (sb-access-token, sb-refresh-token, etc.) are cleared
    And the refresh token is invalidated at Supabase
    And I am redirected to /sign-in

Scenario: After sign-out, gated routes require re-auth
  Given I have just signed out
  When I attempt to navigate directly to /projects
  Then middleware redirects me to /sign-in?next=/projects

Scenario: Sign-out from /sign-out is allowed even mid-onboarding
  Given I am authenticated but is_onboarded = false
    And I am on /onboarding/studio
  When I open the account menu and click "Sign out"
  Then the sign-out completes
    And I am redirected to /sign-in
    And on next sign-in I resume onboarding at /onboarding/studio (per US-103)

Scenario: Sign-out is idempotent
  Given I have already signed out
  When I trigger sign-out again (e.g. duplicate request, stale tab)
  Then no error is shown
    And I remain on /sign-in
```

## UX notes

- No dedicated screen — sign-out lives in the account menu (header avatar / icon) on every authenticated screen.
- Menu item label: **"Sign out"**.
- After sign-out: redirect to `/sign-in` (not the marketing root) — keeps the "next session" loop tight.
- No confirmation modal ("Are you sure?") — sign-out is reversible by signing in again, and the friction would annoy daily users.

## Technical notes

- **Implementation:** Server Action POSTing to `/auth/sign-out` (Route Handler), which calls `supabase.auth.signOut()` server-side.
- **Cookie clearing:** must clear all `sb-*` cookies set by `@supabase/ssr` ([ADR-0006](../../architecture/adr/0006-session-strategy.md)) — `Set-Cookie` headers with `Max-Age=0`.
- **Refresh token invalidation:** Supabase `signOut()` revokes the refresh token server-side, so a stolen refresh token can't mint new access tokens after sign-out.
- **`/sign-out` and `/auth/sign-out` are public-bypass routes** in middleware ([ADR-0007](../../architecture/adr/0007-auth-data-model.md) § Public paths) — even mid-onboarding or unauthenticated users can hit these without redirect loops.
- **No DB writes** — sign-out only mutates session state, not `profiles` or `subscriptions`.

## Test plan

- **E2E (Playwright):** sign in → click "Sign out" → assert cookies are cleared and redirect to `/sign-in`.
- **E2E:** after sign-out, navigating to `/projects` redirects to `/sign-in?next=/projects`.
- **E2E:** sign out mid-onboarding → on next sign-in, land on the same onboarding step.
- **E2E:** double sign-out (two tabs racing) — no error, second request idempotent.
- **Unit:** middleware allows `/auth/sign-out` regardless of auth state.
- **Manual:** verify in DevTools that all `sb-*` cookies are cleared.

## Out of scope

- "Sign out everywhere" / global session revocation across devices — post-MVP, requires session-list UI.
- Account deletion — not in MVP scope. Tracked separately when GDPR/CCPA process is defined.
- Auto sign-out on inactivity — not in MVP. Cookie expiry from [ADR-0006](../../architecture/adr/0006-session-strategy.md) handles eventual session aging.

## Open questions

- Should we clear local component state (e.g. unsaved item-form drafts) on sign-out? Recommend: yes, full client-state reset so the next user on a shared device starts clean.
