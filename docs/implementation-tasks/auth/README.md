# Auth

**Goal.** Ship the complete authentication surface for Speclyy: shared-auth Supabase provisioning, auth-adjacent schema, SSR client factories, middleware route gates, the sign-in page (Google + email OTP), the OTP verify page, the `/auth/callback` route, and sign-out. Onboarding screens are a separate group (they depend on this one); billing is also separate.

**Outcome.** A visitor can hit any route and be routed to the right place: public → render, unauthenticated → `/sign-in`, authenticated but not onboarded → `/onboarding/name`, authenticated + onboarded → app. Sessions survive silent refresh and are killed cleanly on sign-out. Per [ADR-0021](../../architecture/adr/0021-single-supabase-project.md), every table lives in the single `speclyy` Supabase project; future `*.speclyy.com` apps reuse the same project for auth.

## Tasks

| ID | Title | Priority | Status | Est | Depends on |
|----|-------|----------|--------|-----|------------|
| [TASK-AUTH-01](TASK-AUTH-01-provision-supabase.md) | Provision shared-auth Supabase project + env wiring | P0 | ✅ done | 2 | — |
| [TASK-AUTH-02](TASK-AUTH-02-db-migration-auth-tables.md) | Initial DB schema — profiles, organizations, members, subscriptions, trigger, RLS | P0 | ✅ done | 3 | TASK-AUTH-01 |
| [TASK-AUTH-03](TASK-AUTH-03-supabase-ssr-clients.md) | Supabase SSR client factories + generated DB types | P0 | ✅ done | 2 | TASK-AUTH-01, TASK-AUTH-02 |
| [TASK-AUTH-04](TASK-AUTH-04-middleware-gates.md) | `middleware.ts` — auth + onboarding gate chain | P0 | ✅ done | 3 | TASK-AUTH-03 |
| [TASK-AUTH-05](TASK-AUTH-05-sign-in-page.md) | `/sign-in` page (Google + email magic link) | P0 | ✅ done | 3 | TASK-AUTH-03 |
| [TASK-AUTH-06](TASK-AUTH-06-otp-verify-page.md) | `/sign-in/verify` — 6-digit OTP entry | P0 | ✅ done | 2 | TASK-AUTH-05 |
| [TASK-AUTH-07](TASK-AUTH-07-auth-callback-route.md) | `/auth/callback` route handler | P0 | ✅ done | 2 | TASK-AUTH-03 |
| [TASK-AUTH-08](TASK-AUTH-08-sign-out.md) | Sign-out server action + account-menu entry | P0 | ✅ done | 1 | TASK-AUTH-04 |

**Total estimate:** 18 points.

**E2E coverage for this group ships separately** in [TASK-TEST-02 — Auth E2E suite](../testing/TASK-TEST-02-auth-e2e-suite.md), after every auth feature task is merged. Feature tasks in this group include unit + manual tests only; do not add Playwright specs inside them.

## Depends on

- None — this is the foundation group.

## Unblocks

- **Onboarding** — every onboarding screen requires an authenticated session and the profile/organizations tables.
- **Billing & Subscription** — needs `profiles.id` + `subscriptions` table + middleware runtime.
- **Account Settings** — edits the same `profiles` / `organizations` rows.
- Every other group — all are behind the middleware gate.

## Source documents

- [`../../mvp-prd.md`](../../mvp-prd.md) § 5 — auth scope
- [`../../mvp-decisions.md`](../../mvp-decisions.md) § 1 (sign-in methods), § 10 (Free indefinite — no trial gate)
- [`../../architecture/auth.md`](../../architecture/auth.md) — end-to-end walkthrough (authoritative for code-level behavior)
- [`../../screen-inventory.md`](../../screen-inventory.md) § 1.1 (Sign-In), § 1.2 (OTP verify — if split out)
- [`../../user-flows.md`](../../user-flows.md) — "Supporting Flow — First-time setup"

## Architecture references

- [ADR-0005 — Auth provider: Supabase Auth](../../architecture/adr/0005-auth-provider.md)
- [ADR-0006 — Session strategy: cookie-based SSR via `@supabase/ssr`](../../architecture/adr/0006-session-strategy.md)
- [ADR-0007 — Auth data model and middleware gates](../../architecture/adr/0007-auth-data-model.md) *(data-model section superseded by ADR-0019; gate chain still authoritative)*
- [ADR-0019 — Multi-app architecture: shared auth project + organizations](../../architecture/adr/0019-multi-app-architecture.md) *(per-app DB boundary superseded by ADR-0021)*
- [ADR-0021 — Single Supabase project for auth and app data](../../architecture/adr/0021-single-supabase-project.md)

## Cross-cutting notes for implementers

- **Onboarding gate is live.** `decidePostAuthRedirect` and `middleware.ts` route unfinished users to `/onboarding/name` and finished users to `/projects` (or to `?next=`). The onboarding group's Server Actions flip `profiles.onboarding_completed_at` on plan-step submit (Free) or billing-success (Pro).
- **Free is indefinite.** There is **no trial-expiry middleware gate** (superseding older ADR-0007 trial language). Paywall fires inside the PDF export Server Action only — out of scope for this group.
- **Sign-in methods:** Google OAuth **and** email magic link / 6-digit OTP. Both routes use the same `/auth/callback`. (Older `mvp-decisions.md § 1` language about "Google only" is superseded by the onboarding plan in `implementation-plans/onboarding.md` which introduced email magic links; follow `architecture/auth.md`.)
- **Cookie domain.** In prod, Supabase session cookies are configured on `.speclyy.com` so sibling apps on subdomains pick up the session automatically ([ADR-0019](../../architecture/adr/0019-multi-app-architecture.md)). Locally this stays on `localhost`. The cookie-domain attribute is set by `@supabase/ssr` in our app code (`cookieOptions.domain`, env-gated to production) — not via the Supabase dashboard.
- **Secret key must never enter a client bundle.** It is used only in the Stripe webhook (billing group) and in ops scripts. All auth-group code uses the publishable key with RLS.
- **`auth.uid()`** is the only user identity the DB should trust. Never read a user id from request headers or client input.
