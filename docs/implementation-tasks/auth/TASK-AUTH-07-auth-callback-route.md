---
id: TASK-AUTH-07
title: /auth/callback route handler
group: auth
status: done
estimate: 2
dependencies: [TASK-AUTH-03]
related_screens: []
related_adrs: [ADR-0005, ADR-0006]
created: 2026-04-22
---

# TASK-AUTH-07 — `/auth/callback` Route Handler

## Goal

Terminate both the Google OAuth round-trip and the magic-link click. Exchange the `?code=` for a session (Supabase sets cookies on the response), then redirect the user to the right next step: onboarding if new, sanitized `next=` if provided, otherwise `/projects`. On failure, bounce back to `/sign-in?error=<code>` with a recognized error code so TASK-AUTH-05 can render the right message.

## Scope

**In scope**
- `apps/web/src/app/auth/callback/route.ts` — GET handler.
- `exchangeCodeForSession` on the server client.
- Post-auth redirect via the shared `decidePostAuthRedirect()` helper (also used by TASK-AUTH-06).
- Error handling for the known Supabase error shapes: consent denied, expired code, unknown.
- Public-path inclusion already set by TASK-AUTH-04.

**Out of scope**
- Profile row creation — handled by the trigger from TASK-AUTH-02.
- Organization row creation — handled by onboarding Server Actions.
- Stripe customer creation — billing group.

## Acceptance criteria

```gherkin
Scenario: Successful exchange, new user
  Given the URL is /auth/callback?code=<valid>
  And after the exchange profiles.onboarding_completed_at IS NULL
  When the handler runs
  Then session cookies are set on the response (httpOnly, Secure, SameSite=Lax)
  And a 302 redirect to /onboarding/name is returned

Scenario: Successful exchange, onboarded user, no next
  Given the URL is /auth/callback?code=<valid>
  And is_onboarded = true
  When the handler runs
  Then a 302 to /projects is returned

Scenario: Successful exchange, onboarded user, valid next
  Given the URL is /auth/callback?code=<valid>&next=%2Fprojects%2F123
  And is_onboarded = true
  When the handler runs
  Then a 302 to /projects/123 is returned

Scenario: Successful exchange, onboarded user, hostile next
  Given the URL is /auth/callback?code=<valid>&next=//evil.com
  When the handler runs
  Then a 302 to /projects is returned (next is rejected)

Scenario: OAuth consent denied
  Given Google redirects to /auth/callback?error=access_denied
  When the handler runs
  Then a 302 to /sign-in?error=oauth_denied is returned
  And no cookies are set

Scenario: Expired / invalid code
  Given exchangeCodeForSession throws an auth error
  When the handler runs
  Then a 302 to /sign-in?error=otp_expired or ?error=oauth_failed is returned
  And no cookies are set

Scenario: Missing code and no error param
  Given /auth/callback is hit with no query string at all
  When the handler runs
  Then a 302 to /sign-in?error=unknown is returned
```

## Architecture references

- [`../../architecture/auth.md`](../../architecture/auth.md) § "Sign-in flow" step 5 — the exchange call.
- [ADR-0006 — Session strategy](../../architecture/adr/0006-session-strategy.md) — cookies are set by Supabase on the response from `exchangeCodeForSession`; do not hand-roll.
- [ADR-0005](../../architecture/adr/0005-auth-provider.md) — both providers land here.

## Implementation notes

- **File:** `apps/web/src/app/auth/callback/route.ts`.
- **Shape:**
  ```ts
  import { NextRequest, NextResponse } from 'next/server'
  import { createServerClient } from '@speclyy/auth/server'
  import { sanitizeNext, decidePostAuthRedirect } from '@speclyy/auth/redirect'

  export async function GET(request: NextRequest) {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const oauthError = url.searchParams.get('error')
    const next = sanitizeNext(url.searchParams.get('next'))

    if (oauthError === 'access_denied') {
      return NextResponse.redirect(new URL('/sign-in?error=oauth_denied', request.url))
    }
    if (!code) {
      return NextResponse.redirect(new URL('/sign-in?error=unknown', request.url))
    }

    const supabase = createServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      const tag = error.message?.toLowerCase().includes('expired') ? 'otp_expired' : 'oauth_failed'
      return NextResponse.redirect(new URL(`/sign-in?error=${tag}`, request.url))
    }

    const target = await decidePostAuthRedirect(supabase, next)
    return NextResponse.redirect(new URL(target, request.url))
  }
  ```
- **`decidePostAuthRedirect` lives in the shared auth package** (consumed by this route + TASK-AUTH-06). Logic:
  1. `supabase.auth.getUser()` — if null, return `/sign-in?error=unknown`.
  2. Query `profiles.is_onboarded` for the user.
  3. If not onboarded → `/onboarding/name`.
  4. If onboarded and `next` present → `next`.
  5. Otherwise → `/projects`.
- **Public path.** Confirmed in TASK-AUTH-04 (`/auth/callback` is public).
- **Never throw.** Always return a redirect. Middleware still covers gated access for subsequent requests.

## Review notes

- **Cookie handling is Supabase's job here.** Don't write Set-Cookie manually. The `createServerClient` cookie adapter forwards them onto the `NextResponse` Supabase builds internally.
- **Error code mapping.** Keep the `?error=` tag list small and in sync with TASK-AUTH-05. Adding a new tag on one side without the other gives a generic "Unknown error."
- **Sanitize `next`** — reviewers: confirm `sanitizeNext` is called *before* the redirect is built.
- **Do not read the user from the exchange response.** Call `getUser()` fresh — it's the one source of truth.
- **Error-message sniffing.** The `expired` heuristic is fragile; if Supabase changes wording it fails open to `oauth_failed`. That's acceptable but call it out in the code comment.

## Test plan

- **Unit:** `decidePostAuthRedirect` — 4 combinations: {onboarded × next?}.
- **Unit:** error-tag mapping — `expired` wording in the Supabase error → `otp_expired`; anything else → `oauth_failed`.
- **Manual:** DevTools cookie check after a successful exchange.
- **Manual:** hit `/auth/callback?error=access_denied` in a browser → lands on `/sign-in?error=oauth_denied`.
- **E2E coverage** (success paths for new/onboarded users, `next=` preservation + sanitization, error routes) ships in [TASK-TEST-02](../testing/TASK-TEST-02-auth-e2e-suite.md).

## Open questions

- None.
