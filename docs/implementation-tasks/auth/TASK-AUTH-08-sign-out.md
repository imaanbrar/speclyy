---
id: TASK-AUTH-08
title: Sign-out server action + account-menu entry
group: auth
status: ready
estimate: 1
dependencies: [TASK-AUTH-04]
related_screens: ["3.1 Projects List"]
related_adrs: [ADR-0006]
created: 2026-04-22
---

# TASK-AUTH-08 — Sign out

## Goal

Let a signed-in user end their session cleanly. Clicking **Sign out** in the header account menu revokes the refresh token at Supabase, clears all `sb-*` cookies, and redirects to `/sign-in`. Works from any authenticated state — including mid-onboarding.

## Scope

**In scope**
- `/auth/sign-out` Route Handler (POST) that calls `supabase.auth.signOut()`.
- "Sign out" entry in the header account menu on every authenticated page, wired to POST `/auth/sign-out` via a Server Action or native form POST.
- Redirect to `/sign-in` on completion.
- Idempotent behavior — double-submit is a no-op.

**Out of scope**
- "Sign out everywhere" / global session revocation — post-MVP.
- Account deletion — separate workstream under legal/GDPR.
- Auto sign-out on inactivity — handled by Supabase's 90-day refresh timeout.

## Acceptance criteria

```gherkin
Scenario: Sign out from an authenticated page
  Given I am signed in and on /projects
  When I open the account menu and click "Sign out"
  Then supabase.auth.signOut() is called server-side
  And the response clears sb-* cookies (Set-Cookie with Max-Age=0)
  And I am redirected to /sign-in

Scenario: After sign-out gated routes re-auth
  Given I just signed out
  When I navigate to /projects
  Then middleware redirects me to /sign-in?next=%2Fprojects

Scenario: Sign out works mid-onboarding
  Given I am authenticated with is_onboarded = false on /onboarding/studio
  When I click Sign out
  Then the sign-out succeeds and I land on /sign-in
  And on next sign-in I resume at /onboarding/name (middleware gate from TASK-AUTH-04)

Scenario: Idempotent
  Given I have already signed out (cookies cleared)
  When I hit /auth/sign-out again
  Then the handler returns a 302 to /sign-in without error

Scenario: Not reachable via GET
  Given I navigate to /auth/sign-out with GET
  Then I get a 405 Method Not Allowed (CSRF-hardening — only POST triggers the action)
```

## Architecture references

- [`../../architecture/auth.md`](../../architecture/auth.md) § "Sign-out flow" — revoke refresh + clear cookies + redirect.
- [ADR-0006 — Session strategy](../../architecture/adr/0006-session-strategy.md) — cookie flags; `signOut` is the right primitive.
- TASK-AUTH-04 — `/auth/sign-out` and `/sign-out` are in the public-path allow list.

## Implementation notes

- **Route:** `apps/web/src/app/auth/sign-out/route.ts` exporting `POST` (and `GET` returning 405).
- **Handler:**
  ```ts
  export async function POST(request: NextRequest) {
    const supabase = createServerClient()
    await supabase.auth.signOut().catch(() => {}) // idempotent
    return NextResponse.redirect(new URL('/sign-in', request.url), { status: 303 })
  }
  ```
- **Account menu item.** The menu lives in the authenticated layout (to be introduced when the first authenticated page lands — likely in the onboarding / dashboard group). For this task, add the menu entry to the existing header component if one exists; otherwise, scaffold the smallest avatar-menu component with just a Sign-out entry and mark other entries as TODO for the settings group.
- **Submit mechanism.** Use a native `<form action="/auth/sign-out" method="post">` button. The resulting full page load to `/sign-in` is exactly what we want: it discards every in-memory client cache (React Query, SWR, Zustand, etc.) so a subsequent login on a shared device starts clean. Do **not** replace this with a `fetch` + client-side navigation that keeps the SPA alive — that would leak the previous user's cached data.
- **CSRF.** SameSite=Lax cookies + POST-only handler + same-origin form submission gives us CSRF protection adequate for the current threat model. Do *not* add a CSRF token here unless we introduce it globally.

## Review notes

- **GET must 405.** If `GET` triggers sign-out, any `<img src="/auth/sign-out">` on a phishing page logs users out — a minor but avoidable annoyance.
- **Cookie clearing.** Verify in DevTools that every `sb-*` cookie shows `Max-Age=0` in the response. Supabase's `signOut` sets this via the same cookie adapter used elsewhere — confirm the middleware client isn't swallowing the Set-Cookie writes.
- **Idempotency.** Handler must not throw if the session is already gone — `.catch(() => {})` or equivalent. Reviewers: make sure a thrown error path exists for observability but the user-facing outcome is still a redirect.
- **Public-path check.** If a reviewer asks why sign-out works without auth, point at TASK-AUTH-04 — `/auth/sign-out` is in the public allow list so mid-onboarding and expired-session users can reach it without redirect loops.
- **No DB writes.** Confirm nothing writes to `profiles` / `organizations` / `subscriptions` here. Sign-out is session-only.

## Test plan

- **Unit:** middleware from TASK-AUTH-04 allows `/auth/sign-out` regardless of auth state (covered by that task's unit matrix; add a dedicated case if missing).
- **Manual:** sign in → click Sign out → DevTools audit confirms all `sb-*` cookies cleared and URL is `/sign-in`.
- **Manual:** after sign-out, try `/projects` and confirm the middleware redirect to `/sign-in?next=%2Fprojects`.
- **Manual:** `GET /auth/sign-out` returns 405 (curl or DevTools).
- **E2E coverage** (from-menu sign-out, post sign-out gate, mid-onboarding sign-out, double-sign-out race, GET-405) ships in [TASK-TEST-02](../testing/TASK-TEST-02-auth-e2e-suite.md).

## Open questions

- None. Client-side caches are cleared by relying on the full page load the native `<form>` POST triggers — no extra `queryClient.clear()` needed.
