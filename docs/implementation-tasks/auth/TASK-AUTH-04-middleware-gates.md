---
id: TASK-AUTH-04
title: middleware.ts — auth + onboarding gate chain
group: auth
status: ready
estimate: 3
dependencies: [TASK-AUTH-03]
related_screens: []
related_adrs: [ADR-0006, ADR-0007]
created: 2026-04-22
---

# TASK-AUTH-04 — Middleware gate chain

## Goal

Ship `apps/web/middleware.ts`. On every non-static request it must (1) refresh the session (rewriting cookies on the response when Supabase issues a new pair), (2) gate unauthenticated requests to `/sign-in`, (3) gate authenticated-but-not-onboarded requests to `/onboarding/name`, (4) prevent onboarded users from re-entering the onboarding flow. This is the one place in the codebase that decides "who can be here right now."

## Scope

**In scope**
- `apps/web/middleware.ts` built on `createMiddlewareClient` from TASK-AUTH-03.
- Public-path list: `/`, `/sign-in`, `/sign-in/verify`, `/auth/callback`, `/auth/sign-out`, `/sign-out`, `/privacy`, `/terms`.
- Route matcher that skips static assets and images.
- Single Postgres read per request for `profiles.is_onboarded`.
- Preservation of the originally-requested URL via a `?next=` query param on the `/sign-in` redirect.
- Table-test unit coverage of the full state matrix.

**Out of scope**
- Any subscription / trial gate. Free is indefinite per [`mvp-decisions.md` § 10](../../mvp-decisions.md); paywalls fire inside the PDF export Server Action (billing group), **not** in middleware.
- Org-switcher logic (multi-org accounts are post-MVP).
- The `/sign-in` page itself — TASK-AUTH-05.

## Acceptance criteria

```gherkin
Scenario: Unauthenticated request to a gated route
  Given I have no valid session cookie
  When I request /projects
  Then I am redirected to /sign-in?next=%2Fprojects

Scenario: Unauthenticated request to a public route
  Given I have no session cookie
  When I request /sign-in or /privacy
  Then the route renders with no redirect

Scenario: Authenticated but not onboarded
  Given I have a session and profiles.onboarding_completed_at IS NULL
  When I request /projects
  Then I am redirected to /onboarding/name

Scenario: Authenticated and onboarded cannot re-enter onboarding
  Given I have a session and is_onboarded = true
  When I request /onboarding/studio
  Then I am redirected to /projects

Scenario: Sign-out path is reachable from any state
  Given I am authenticated but mid-onboarding
  When I request /sign-out or /auth/sign-out
  Then the request proceeds without redirect

Scenario: Session is silently refreshed
  Given my access token has just expired but the refresh token is valid
  When any non-static request hits middleware
  Then the response includes Set-Cookie headers for sb-*-auth-token
  And the request proceeds normally with no user-visible redirect

Scenario: next= param is sanitized
  Given a crafted URL like /sign-in?next=//evil.com
  When I successfully sign in
  Then I am NOT redirected to evil.com
  And I am redirected to /projects instead
```

## Architecture references

- [`../../architecture/auth.md`](../../architecture/auth.md) § "Middleware gate chain" — **authoritative code sketch; copy and adapt**.
- [ADR-0006 — Session strategy](../../architecture/adr/0006-session-strategy.md) — silent-refresh mechanics and cookie flags.
- [ADR-0007 — Auth data model and middleware gates](../../architecture/adr/0007-auth-data-model.md) — rationale for the gate order. Note: the "trial expired → /billing" gate described in older revisions is **NOT wired** (Free is indefinite).

## Implementation notes

- **Matcher.**
  ```ts
  export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg)).*)'],
  }
  ```
- **Order of operations (critical).**
  1. Create `response = NextResponse.next({ request })`.
  2. Build the middleware client from TASK-AUTH-03 with `(request, response)` so the cookie adapter can write Set-Cookie on `response`.
  3. `await supabase.auth.getUser()` — this is what triggers the silent refresh.
  4. Compute `isPublic` against the public-path list.
  5. If no user: public → return response; else redirect to `/sign-in?next=<current>`.
  6. If user but no profile row: defensive — treat as not-onboarded (the trigger should have created the row; this is an edge case).
  7. Read `profiles.is_onboarded` with a single typed `.select('is_onboarded').eq('id', user.id).maybeSingle()`.
  8. Apply onboarding gates per the Gherkin above.
- **Public paths list.** Must include both `/sign-out` (the UI surface) and `/auth/sign-out` (the Route Handler). Omitting either causes a redirect loop.
- **`next=` sanitization.** Reject any value that does not start with exactly one `/` (rejects `//evil.com`), that contains `\`, or that starts with `/auth/` or `/sign-in`. Fallback to `/projects`. Implement as a small pure function and unit-test it.
- **Single DB read.** Do not call `getUser()` more than once. Do not query `profiles` when `user` is null.
- **Never throw.** Middleware errors silently breaking the app is a bad outcome; a thrown error makes every page 500. Wrap the Supabase call in a try/catch and, on failure, fall through as unauthenticated (fail closed).

## Review notes

- **Open-redirect review.** `next=` is the classic phishing foothold. Confirm the sanitizer is used on *every* consumer of `next=` (middleware build, `/sign-in` form, `/auth/callback`). If one site forgets to sanitize, the whole control is moot.
- **Cookie rewriting.** Verify both `request.cookies.set` *and* `response.cookies.set` are called in the adapter — if only one is, downstream RSC reads see stale cookies during a refresh.
- **Gate order.** Onboarding gate must run *after* the auth gate (you can't ask an unauthenticated user to onboard). Unit tests should enforce this by construction, not by manual checklist.
- **No subscription gate.** If a reviewer asks "where do we redirect trial-expired users?" — answer: nowhere, by design. Paywalls are inside the export Server Action. Link to `mvp-decisions.md § 10`.
- **`is_onboarded` is a generated column** (TASK-AUTH-02). Don't compute it again in middleware.
- **Matcher excludes.** If a static asset ends up behind the matcher, every image load triggers a `getUser()` round-trip. Ensure the regex matches the current `next.config` static paths.

## Test plan

- **Unit (Vitest / Jest):** table-test the pure gate function over the full matrix: `{auth in [none, ok], onboarded in [—, false, true], path in [public, /onboarding/*, /projects, /sign-out]}`. Assert `{action: 'continue' | 'redirect', target?: string}`.
- **Unit:** `sanitizeNext()` — include cases `/projects`, `/`, `//evil.com`, `/\\\\evil.com`, `http://evil.com`, `/auth/callback`, `/sign-in` (self-loop), empty, undefined.
- **Manual:** verify cookie flags in DevTools: `HttpOnly`, `Secure`, `SameSite=Lax`, correct domain.
- **Manual:** trigger silent refresh locally (set short JWT expiry on the test project) and confirm a fresh `Set-Cookie` header appears on a subsequent navigation.
- **E2E coverage** (redirect matrix, silent refresh, `next=` preservation) ships in [TASK-TEST-02](../testing/TASK-TEST-02-auth-e2e-suite.md) — do not add Playwright specs here.

## Decisions

- **No middleware redirect logging** in any environment (dev or prod). The redirect target is already visible on the response; per-request logs are noise that slows the hot path.

## Open questions

- None.
