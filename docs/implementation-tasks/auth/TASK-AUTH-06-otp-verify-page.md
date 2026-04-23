---
id: TASK-AUTH-06
title: /sign-in/verify — 6-digit OTP entry
group: auth
status: ready
estimate: 2
dependencies: [TASK-AUTH-05]
related_screens: ["1.2 Sign-In · Verify"]
related_adrs: [ADR-0005, ADR-0006]
created: 2026-04-22
---

# TASK-AUTH-06 — `/sign-in/verify` page

## Goal

Offer a 6-digit code entry screen for users who prefer typing the OTP to clicking the magic link in their email. On a valid code, set cookies and redirect via the same post-auth logic used by `/auth/callback`. Rate-limit-aware resend with a 60s cooldown.

## Scope

**In scope**
- Route: `apps/web/src/app/(auth)/sign-in/verify/page.tsx`.
- 6-digit code input (numeric), auto-advance between digits, paste support.
- Verify via `supabase.auth.verifyOtp({ email, token, type: 'email' })`.
- Resend button with visible 60s cooldown.
- Error states: invalid code, expired code, rate-limit hit, network.
- Post-verify redirect uses the same onboarding-aware logic as `/auth/callback` — extract a shared helper from TASK-AUTH-07.

**Out of scope**
- The magic-link path (clicking the link in email) — that lands on `/auth/callback` directly, not here.
- Back-navigation to re-enter a different email — user can hit browser back; we don't need a custom button.

## Acceptance criteria

```gherkin
Scenario: Happy path — correct code
  Given I arrived here from /sign-in with email=alice@example.com
  And I received the 6-digit code
  When I enter the 6 digits
  Then supabase.auth.verifyOtp is called with type='email'
  And on success the session cookies are set
  And I am redirected per onboarding state (onboarding start OR /projects OR sanitized next)

Scenario: Invalid code
  Given I enter a 6-digit code that doesn't match
  When verifyOtp returns an error
  Then an inline error "That code didn't work. Try again or resend." appears
  And the input is cleared and focused

Scenario: Expired code
  Given the code is > 60 minutes old
  When verifyOtp returns an "otp_expired" error
  Then the inline error prompts to resend
  And clicking Resend sends a fresh code

Scenario: Resend cooldown
  Given I just clicked Resend
  When I attempt to click Resend again within 60 seconds
  Then the button is disabled and shows the remaining seconds

Scenario: Missing email query param
  Given I open /sign-in/verify directly with no ?email=
  When the page loads
  Then I am redirected to /sign-in

Scenario: next is preserved through verify
  Given I arrived with ?email=…&next=%2Fprojects%2F123
  When I successfully verify
  Then I am redirected to /projects/123 (if onboarded; otherwise onboarding wins)
```

## Architecture references

- [`../../architecture/auth.md`](../../architecture/auth.md) § "Email OTP (magic code)" — `verifyOtp` call and cookie setup.
- [ADR-0005](../../architecture/adr/0005-auth-provider.md) — email OTP is a supported MVP method.
- [`../../implementation-plans/onboarding.md`](../../implementation-plans/onboarding.md) § "Design resolution · Sign-in — single page" — 6-digit code + 60s resend cooldown is an explicit decision.

## Implementation notes

- **File:** `apps/web/src/app/(auth)/sign-in/verify/page.tsx`.
- **Form:** six single-char numeric inputs or one `<input inputmode="numeric" maxlength="6">` with letter-spacing. Prefer the latter — simpler, better paste support.
- **Auto-submit** when 6 digits present.
- **Verify:**
  ```ts
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  ```
- **Post-verify redirect.** Extract `decidePostAuthRedirect(user, supabase, next)` to a shared module imported by both this page and `/auth/callback` (TASK-AUTH-07). It returns one of `/onboarding/name`, sanitized `next`, or `/projects`.
- **Resend** calls `signInWithOtp({ email, options: { shouldCreateUser: false } })`. Track the last-sent timestamp in `useState`; derive the disabled state + countdown from `Date.now()`.
- **`shouldCreateUser: false` on resend** avoids a race where re-sending to a user who deleted their account mid-session would re-create them. Initial send (on `/sign-in`) uses `true`.
- **Accessibility:** `aria-live="polite"` on the error region; `aria-describedby` on the input pointing at the helper.

## Review notes

- **Never log the OTP.** Don't `console.log(token)` anywhere, not even in dev.
- **Don't store email in localStorage.** Pass it only via the query param — it's ephemeral.
- **Cooldown enforced server-side too.** Supabase enforces 1/60s per email; do not assume your client-side countdown is the source of truth.
- **Paste handling.** A user pasting "123 456" or "123-456" should normalize to `123456`. Strip non-digits.
- **Redirect helper reuse.** If this page and the callback route diverge in redirect logic, a user signing in via link vs code will land differently. That's a bug magnet — share the helper.
- **Open-redirect.** `next` must pass the same `sanitizeNext()` used everywhere else.

## Test plan

- **Unit:** paste "1 2 3-4 5 6" normalizes to "123456".
- **Unit:** `decidePostAuthRedirect` table test — covers onboarded+next, onboarded+no-next, not-onboarded, no profile.
- **Unit:** cooldown derivation — given a last-sent timestamp, the derived disabled state and countdown are correct.
- **Manual:** request a code, enter it, and verify DevTools — `sb-*-auth-token` cookie with correct flags.
- **Manual:** wrong code + resend flow feels right.
- **E2E coverage** (happy path with inbox fixture, wrong-code, resend cooldown, missing-email redirect) ships in [TASK-TEST-02](../testing/TASK-TEST-02-auth-e2e-suite.md).

## Open questions

- None.
