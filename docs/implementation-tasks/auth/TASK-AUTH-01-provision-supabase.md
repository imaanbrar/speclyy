---
id: TASK-AUTH-01
title: Provision shared-auth Supabase project + env wiring
group: auth
status: ready
estimate: 2
dependencies: []
related_screens: []
related_adrs: [ADR-0005, ADR-0006, ADR-0019]
created: 2026-04-22
---

# TASK-AUTH-01 — Provision shared-auth Supabase project + env wiring

## Goal

Stand up the **shared auth** Supabase project that will be reused by every `*.speclyy.com` app ([ADR-0019](../../architecture/adr/0019-multi-app-architecture.md)), configure Google OAuth + email OTP, set a 90-day refresh-token inactivity timeout, and wire the resulting secrets into local dev and Vercel. Nothing else in the auth group can ship without this.

## Scope

**In scope**
- Create a new Supabase project named `speclyy-auth` (or equivalent; document the name in this task's PR).
- Enable Google OAuth provider with production + local redirect URIs.
- Enable email sign-in with OTP / magic link (same template covers sign-up and sign-in).
- Set Auth → Sessions → Inactivity timeout = 90 days.
- Configure the session **cookie domain** for prod: `.speclyy.com` (leave local as default).
- Capture secrets and add to Vercel (preview + production) and to `.env.local.example` with placeholder values.
- Document the provisioning steps in `architecture/deployments.md` (or a new `operations/supabase-provisioning.md`) so a second engineer can reproduce it.

**Out of scope**
- Creating the per-app Speclyy database (separate project; different task group).
- Seeding any rows in `profiles` / `organizations` — the trigger in TASK-AUTH-02 handles that.
- Stripe provisioning — billing group.

## Acceptance criteria

```gherkin
Scenario: Google OAuth is reachable end-to-end in local dev
  Given the Supabase project exists with Google provider enabled
    And http://localhost:3000/auth/callback is in the allowed redirect list
  When I call supabase.auth.signInWithOAuth({ provider: 'google', redirectTo: 'http://localhost:3000/auth/callback' })
  Then the browser reaches Google's consent screen
    And after consent it returns to /auth/callback with a ?code= param

Scenario: Email OTP delivers a code
  Given email provider is enabled with the default template
  When I call supabase.auth.signInWithOtp({ email: '<inbox>' })
  Then an email arrives within 60s containing a 6-digit code and a magic link

Scenario: Env placeholders exist
  Given I clone the repo fresh and copy .env.local.example to .env.local
  Then .env.local contains NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY placeholders
    And the README / provisioning doc explains how to obtain real values

Scenario: 90-day inactivity timeout is set
  Given the Supabase dashboard Auth → Sessions panel
  Then "Inactivity timeout" is configured to 90 days
```

## Architecture references

- [ADR-0005 — Auth provider: Supabase Auth](../../architecture/adr/0005-auth-provider.md) — why Supabase is the provider.
- [ADR-0006 — Session strategy: cookie-based SSR](../../architecture/adr/0006-session-strategy.md) — 90-day refresh, cookie flags.
- [ADR-0019 — Multi-app architecture](../../architecture/adr/0019-multi-app-architecture.md) — this project is *shared* across future apps; the `.speclyy.com` cookie domain setting lives here.
- [`../../architecture/auth.md`](../../architecture/auth.md) § "Session lifecycle" — token TTLs.

## Implementation notes

- **Env vars to populate (Vercel preview + prod + `.env.local`):**
  - `NEXT_PUBLIC_SUPABASE_URL` — project URL.
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — publishable anon key. Safe in client bundle.
  - `SUPABASE_SERVICE_ROLE_KEY` — privileged key. **Server-only**; never `NEXT_PUBLIC_`. Used by the Stripe webhook and ops scripts.
  - Add to `.env.local.example` with dummy values and comments.
- **Redirect URIs to register with Google Cloud Console and inside Supabase → Auth → URL Configuration:**
  - `http://localhost:3000/auth/callback`
  - `https://<preview-*>.vercel.app/auth/callback` (wildcard if supported, else enumerate)
  - `https://app.speclyy.com/auth/callback` (or whatever prod host is wired up)
- **Supabase Auth settings checklist:**
  - Providers → Google: on. Client ID / secret from GCP OAuth consent screen.
  - Providers → Email: on; "Confirm email" optional (we use OTP, so this is about enumeration resistance — keep on).
  - Sessions → Inactivity timeout: 90 days.
  - URL Configuration → Site URL: prod URL.
  - URL Configuration → Cookie domain (prod only): `.speclyy.com`.
- **GCP OAuth consent screen** — mark it External, add the logo, privacy-policy URL, ToS URL.

## Review notes

- **Service-role key hygiene.** Confirm the PR does not add `SUPABASE_SERVICE_ROLE_KEY` to any `NEXT_PUBLIC_*` location, does not log it, and does not import it into any file inside `apps/*/src/app/` client boundary.
- **Redirect URI list is closed.** Any extra `/auth/callback` target (e.g. a staff member's ngrok) is a phishing vector — don't leave test URIs in prod config.
- **Cookie domain typo risk.** `speclyy.com` vs `.speclyy.com` matters: the leading dot is what makes the cookie shared with subdomains. Screenshot/verify in review.
- **Google OAuth consent scopes** should be `email` + `profile` only — no extra scopes.
- **Provisioning doc** must be specific enough that another engineer (or an incident responder) can rebuild this from scratch without tribal knowledge.

## Test plan

- **Manual:** run the two happy-path scenarios above against the live dev project.
- **Manual:** in prod, trigger sign-in from `https://<preview>.vercel.app` and confirm redirect URIs don't error.
- **Manual:** open DevTools after sign-in and verify the `sb-<project-ref>-auth-token` cookie is present with `HttpOnly`, `Secure`, `SameSite=Lax`, and (in prod) `Domain=.speclyy.com`.
- **Doc check:** a second engineer follows the provisioning doc on a scratch Supabase org and reaches "Google OAuth reaches consent screen" without asking questions.

## Decisions

- **One GCP OAuth client** across local / preview / production, with every callback URI enumerated in its redirect list. Revisit only if Google's verification process pushes back.

## Open questions

- None.
