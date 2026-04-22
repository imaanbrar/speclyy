# Epic 1 — Authentication & Onboarding

**Goal:** Get a designer from "never heard of Speclyy" to "ready to create their first project" in under 90 seconds, on the Free plan, with no friction and no payment friction.

**Primary persona:** [Designer](../personas.md#designer-designer--primary)
**Secondary persona:** [Prospect](../personas.md#prospect-prospect--pre-sign-in) (until US-101 completes)

## Stories

| ID | Title | Priority | Status | Est |
|----|-------|----------|--------|-----|
| [US-101](US-101-sign-in-with-google.md) | Sign in with Google | P0 | 🔜 ready | 3 |
| [US-102](US-102-onboarding-name.md) | Onboarding — your name | P0 | 🔜 ready | 2 |
| [US-103](US-103-onboarding-studio-name.md) | Onboarding — studio name | P0 | 🔜 ready | 2 |
| [US-104](US-104-onboarding-market.md) | Onboarding — select market | P0 | 🔜 ready | 2 |
| [US-105](US-105-onboarding-plan-overview.md) | Onboarding — plan overview | P0 | 🔜 ready | 2 |
| [US-106](US-106-first-time-empty-state.md) | First-time empty state on dashboard | P1 | 🔲 draft | 1 |
| [US-107](US-107-sign-out.md) | Sign out | P0 | 🔲 draft | 1 |

**Total estimate:** 13 points

## Depends on

- None — this is the foundation epic.

## Unblocks

- **Epic 2 (Project Management)** — every project-scoped action requires an authenticated, onboarded session.
- **Epic 8 (Billing & Subscription)** — needs `profiles.id` to associate Stripe customer.
- **Epic 9 (Account Settings)** — edits the same `profiles` row populated during onboarding.

## Source documents

- [`../../mvp-prd.md`](../../mvp-prd.md) § 5 (auth scope)
- [`../../mvp-decisions.md`](../../mvp-decisions.md) § 1 (Auth = Google OAuth only), § 4 (Business model — Free is indefinite, no trial), § 10 (4-screen onboarding)
- [`../../screen-inventory.md`](../../screen-inventory.md) § 1.1, § 2.1–2.4
- [`../../user-flows.md`](../../user-flows.md) — "Supporting Flow — First-time setup"

## Architecture references

- [ADR-0005 — Auth provider: Supabase Auth](../../architecture/adr/0005-auth-provider.md)
- [ADR-0006 — Session strategy: cookie-based SSR](../../architecture/adr/0006-session-strategy.md)
- [ADR-0007 — Auth data model and middleware gates](../../architecture/adr/0007-auth-data-model.md)
- [`../../architecture/auth.md`](../../architecture/auth.md) — narrative end-to-end walkthrough

## Notes for implementers

- Per the latest [`mvp-decisions.md`](../../mvp-decisions.md) § 10, the Free plan is **indefinite** — no 7-day trial. The trial-gate language in older revisions of ADR-0005 / ADR-0007 should be treated as superseded; the paywall fires only on PDF export attempts (Epic 7).
- The onboarding flow always lands on US-105 (plan overview) — even when a promo code was redeemed at sign-in. The plan overview is informational, not a payment gate.
- The middleware gate chain in ADR-0007 still applies: unauthenticated → `/sign-in`; authenticated + not onboarded → `/onboarding/name`. The "trial expired → /billing" gate is no longer wired (Free is indefinite).
