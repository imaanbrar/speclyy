---
id: TASK-AUTH-05
title: /sign-in page — Google OAuth + email magic link
group: auth
status: done
estimate: 3
dependencies: [TASK-AUTH-03]
related_screens: ["1.1 Sign-In"]
related_adrs: [ADR-0005, ADR-0006]
created: 2026-04-22
---

# TASK-AUTH-05 — `/sign-in` page

## Goal

Ship the single sign-in page: **Continue with Google** (primary pill) and below an "or" divider an inline email input with a **Send link** button that kicks off email OTP / magic link. Errors render inline above the CTAs. A valid `?next=` query param is threaded through both flows so middleware-redirected users return to the page they were trying to visit.

## Scope

**In scope**
- Route: `apps/web/src/app/(auth)/sign-in/page.tsx` (Server Component shell + Client Component form).
- Google OAuth trigger via `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: <origin>/auth/callback?next=<sanitized> } })`.
- Email OTP trigger via `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: <origin>/auth/callback?next=<sanitized> } })`. On success navigate to `/sign-in/verify?email=<enc>&next=<sanitized>`.
- Inline error rendering driven by `?error=<code>` (set by `/auth/callback` on failure paths).
- Terms & Privacy footer links.
- Speclyy logo + tagline.

**Out of scope**
- Promo code field. (Superseded: the onboarding plan folded plan selection into Step 4 of onboarding; sign-in is method-only.)
- Apple / Microsoft SSO — see [`mvp-decisions.md`](../../mvp-decisions.md) and [`../../roadmap.md`](../../roadmap.md).
- The OTP verify page — TASK-AUTH-06.
- The callback route — TASK-AUTH-07.

## Acceptance criteria

```gherkin
Scenario: Google flow starts
  Given I am on /sign-in
  When I click "Continue with Google"
  Then the browser navigates to accounts.google.com for consent
  And on return, Google redirects to /auth/callback?code=…

Scenario: Email flow sends a code
  Given I enter a valid email and click "Send link"
  When the request resolves
  Then I am navigated to /sign-in/verify?email=<url-encoded>&next=<sanitized>
  And a 6-digit code arrives at the inbox within 60s

Scenario: Email flow validation
  Given I enter "" or an obviously-invalid email
  When I click "Send link"
  Then an inline error appears above the input
  And no request is made to Supabase

Scenario: Rate-limit / transient error surfaces cleanly
  Given signInWithOtp returns a rate-limit error
  When the error is received
  Then an inline message appears: "Too many attempts — wait 60s and try again."
  And the Send link button is disabled for 60 seconds

Scenario: ?next param is preserved across both flows
  Given I arrived at /sign-in?next=%2Fprojects%2F123
  When I trigger either the Google or email flow
  Then the redirectTo / emailRedirectTo passes next=/projects/123
  And the same param reaches /auth/callback

Scenario: ?next param is sanitized
  Given I arrived at /sign-in?next=//evil.com
  When the page renders
  Then next is dropped (treated as empty) and post-sign-in will default to /projects
```

## Architecture references

- [`../../architecture/auth.md`](../../architecture/auth.md) § "Sign-in flow" — code snippets for both the OAuth and OTP calls.
- [ADR-0005 — Auth provider](../../architecture/adr/0005-auth-provider.md) — Google + email as MVP methods.
- [ADR-0006 — Session strategy](../../architecture/adr/0006-session-strategy.md) — cookie setup happens in `/auth/callback`, not here.
- [`../../screen-inventory.md`](../../screen-inventory.md) § 1.1 Sign-In.
- [`../../implementation-plans/onboarding.md`](../../implementation-plans/onboarding.md) § "Design resolution · Sign-in — single page" — copy and layout.

## Implementation notes

- **Routes / files:**
  - `apps/web/src/app/(auth)/sign-in/page.tsx` — Server Component; reads `searchParams.error`, `searchParams.next`; sanitizes `next`.
  - `apps/web/src/app/(auth)/sign-in/_components/sign-in-form.tsx` — Client Component that owns both buttons.
- **Reuse `sanitizeNext()`** from TASK-AUTH-04. Do not re-implement.
- **Client factory:** `createBrowserClient()` from TASK-AUTH-03.
- **Google call:**
  ```ts
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback${nextParam}` },
  })
  ```
- **Email call:**
  ```ts
  await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback${nextParam}`,
      shouldCreateUser: true,
    },
  })
  router.push(`/sign-in/verify?email=${encodeURIComponent(email)}${nextParam ? `&next=${encodeURIComponent(next)}` : ''}`)
  ```
- **Error codes.** The page recognizes `?error=` values set by `/auth/callback`. Start with: `oauth_denied`, `oauth_failed`, `otp_expired`, `unknown`. Render a short friendly message per code; unknown falls through to a generic message.
- **Disable the submit button while the request is in flight** to prevent double-sends.
- **Copy:**
  - Primary: **Continue with Google**.
  - Divider: **or**.
  - Email label: **Email** (placeholder `you@studio.com`).
  - Secondary CTA: **Send link** (not "Submit", not "Continue").
  - Helper under the email: *"We'll email a magic link and a 6-digit code — no password."*
  - Footer line 1: `By continuing, you agree to our Terms and Privacy Policy.` with two links.
  - Footer line 2 (small, muted): `We'll keep you signed in on this browser.` — replaces a "Remember me" checkbox; matches Supabase's 90-day inactivity session.

## Review notes

- **Open-redirect.** Confirm the page does *not* read `window.location.href` or user input and stuff it directly into `redirectTo` — only the sanitized `next` goes through.
- **Email enumeration.** Supabase's default OTP flow responds the same way for known and unknown emails; keep it that way. Do not display "account not found" errors.
- **No secrets in bundle.** The page must only use the anon key. Double-check `NEXT_PUBLIC_*` envs only.
- **Accessibility.** Buttons have distinct `type=` and `aria-busy` while loading. Error region is `role="alert"` so screen readers announce it.
- **Rate-limit UX.** Disable for 60s and show the countdown — don't just show an error and let the user hammer the button.
- **Mobile.** Email input has `type="email"`, `autocomplete="email"`, `inputmode="email"`, `spellcheck={false}`.
- **No password field.** If a reviewer suggests one, point at [ADR-0005](../../architecture/adr/0005-auth-provider.md).

## Test plan

- **Unit:** form validation — empty / invalid / valid emails; `sanitizeNext` rejects the hostile cases.
- **Unit:** error-code → message mapping covers `oauth_denied`, `oauth_failed`, `otp_expired`, `unknown`.
- **Manual:** visual / layout — matches design. Tab order goes Google → email → Send link.
- **Manual:** submit with a real Gmail and confirm an inbox arrival of both the magic link and 6-digit code.
- **Manual:** click Continue with Google and confirm the external URL starts with `https://accounts.google.com/o/oauth2/`.
- **E2E coverage** (both flows, `?error=` rendering, `next=` preservation and sanitization) ships in [TASK-TEST-02](../testing/TASK-TEST-02-auth-e2e-suite.md).

## Open questions

- None.
