---
id: TASK-TEST-04
title: Billing E2E suite (Playwright)
group: testing
status: ready
estimate: 5
dependencies: [TASK-TEST-01, TASK-BILL-01, TASK-BILL-02, TASK-BILL-03, TASK-BILL-04, TASK-BILL-05, TASK-BILL-06, TASK-BILL-07, TASK-BILL-08]
related_screens: ["2.4a", "2.4b", "7.X Export Paywall"]
related_adrs: [ADR-0017, ADR-0018]
created: 2026-04-22
---

# TASK-TEST-04 — Billing E2E suite

## Goal

Cover the Pro purchase flow end-to-end with Stripe test cards, webhook delivery, and DB reconciliation; cover the paywall modal's Free → Upgrade loop; cover portal-driven cancel → `canceled` status. Builds on [TASK-TEST-01](TASK-TEST-01-playwright-harness.md)'s harness.

## Scope

**Specs under `e2e/billing/`**
- `pro-purchase.spec.ts`
  - New user: sign-in → onboard Name/Studio/Market → Plan step → select Pro annual → embedded checkout → test card 4242 → `/billing/success` → assert `subscriptions.status = 'active'` AND `profiles.onboarding_completed_at` populated → navigates to `/projects`.
  - Variant: monthly interval → same assertions with `current_period_end` ~ 1 month.
  - Variant: declined card 4000 0000 0000 0002 → inline error on checkout, no DB row.
  - Variant: 3DS card 4000 0025 0000 3155 → extra-auth completes, lands on success.
- `webhook.spec.ts`
  - Drive events via `stripe trigger` (or a signed-event fixture) and assert DB convergence:
    - `customer.subscription.created` → row with correct fields.
    - `invoice.payment_failed` on active sub → `status = 'past_due'`.
    - `customer.subscription.deleted` → `status = 'canceled'`.
  - Replay the same event twice → only one processed row, one DB write.
  - Out-of-order: send an old `customer.subscription.updated` after a newer one → newer wins.
  - Tampered signature → 400.
- `success-polling.spec.ts`
  - Delay webhook by 3s; assert the success page shows the finalizing state then transitions to success.
  - Stop webhook entirely; assert the 15s fallback copy appears and `onboarding_completed_at` is NOT set.
- `paywall.spec.ts`
  - Free user attempts export → modal opens with blurred preview, no download button.
  - Click "Upgrade and export" → lands on `/onboarding/checkout` with valid clientSecret.
  - Completing payment → return to project → `isPro()` resolves true.
  - Dismiss → back to project, no state change.
- `portal.spec.ts`
  - Pro user → `/billing` → Manage billing → portal session URL 302.
  - (Portal session itself is outside CI scope; assert redirect and URL shape.)
  - Simulated `customer.subscription.deleted` via `stripe trigger` → `/billing` reflects canceled state on next render.

**Fixtures added (implementations)**
- `triggerStripeEvent(type, overrides?)` — uses `stripe trigger` or crafts a signed event for the test endpoint.
- `seedProUser({ interval })` — creates an `auth.users` + pre-activated subscription row via service-role (skips the real Stripe round-trip for specs that need a Pro user but aren't testing the purchase flow itself).
- `seedActiveStripeCustomer()` — real Stripe test-mode customer + subscription, used by portal + cancel specs.

**Out of scope**
- Stripe Tax — not configured (billing open question).
- Hosted Checkout flows — superseded by embedded Elements ([ADR-0018](../../architecture/adr/0018-payment-surface.md)).
- Real email receipt verification — trust Stripe.

## Acceptance criteria

```gherkin
Scenario: Suite is green on CI
  Given the billing group is merged and deployed to the test environment
  When the workflow runs
  Then every spec in e2e/billing/ passes
  And the full purchase spec completes in under 45s per variant

Scenario: No live-mode leak
  Given the suite is configured
  Then STRIPE_SECRET_KEY begins with 'sk_test_' in every CI run
  And the fixtures assert this before any call

Scenario: Webhook signature verification exercised
  Given the tampered-signature spec
  Then the handler returns 400 and no subscription write occurs

Scenario: Idempotency proven
  Given the replay spec
  Then the second delivery increments no subscriptions writes
  And processed_webhook_events contains one row for that event id
```

## Architecture references

- [`../../architecture/billing.md`](../../architecture/billing.md) — the full contract this suite enforces.
- [ADR-0018 — Payment surface](../../architecture/adr/0018-payment-surface.md) — embedded Elements, not Checkout.

## Implementation notes

- **Stripe test keys only.** Every fixture asserts `sk_test_` prefix. Loudly fail if not.
- **Webhook delivery in tests.** Two strategies:
  1. `stripe listen` running alongside `webServer`, with `stripe trigger` invocations in specs.
  2. Crafted signed events POSTed directly to the handler with the test webhook secret.

  Prefer (2) for deterministic CI; use (1) for the full-purchase happy path where Stripe's own event stream is the realism we want.
- **Delay-for-polling.** Use a test-only toggle (env flag or DB row marker) that temporarily stalls the handler by N seconds — cleaner than racing real network.
- **Do not run the portal end-to-end.** Stripe's portal UI is external; just assert our redirect and then drive state changes via `stripe trigger`.
- **Avoid time-sensitive assertions.** `current_period_end` check uses a tolerance window, not an exact timestamp.

## Review notes

- **Real charges impossible in test mode** — still, review that no spec accidentally references a live price ID or a live customer.
- **Resource leakage.** Each purchase spec creates a Stripe customer + subscription. They auto-expire (`incomplete_expired` after 23h for unpaid) but review cleanup hygiene anyway — prune at suite teardown for chatter reduction.
- **Polling spec quality.** The delayed-webhook spec must assert the intermediate UI state, not just the final one — otherwise a regression that *skips* the polling UI still passes.
- **No service-role leak.** Fixtures that need service-role live under `e2e/fixtures/` only; grep spec files.
- **Flakes.** Payment intents occasionally take multiple seconds; generous per-test timeouts (up to 45s) for the purchase flow. Keep paywall/portal specs tight.

## Test plan

This task is the test plan for the Billing group. Self-verification:

- Run locally with `stripe listen` and real test keys — all specs green.
- Break-the-build: temporarily remove the signature check in TASK-BILL-05; confirm the tampered-signature spec turns red.
- Break-the-build: drop the `updated_at` guard in the webhook upsert; confirm the out-of-order spec turns red.

## Open questions

- Whether portal cancel should be tested via `stripe trigger` (recommended) or by actually driving the portal UI in Playwright (brittle). Recommendation: trigger-only in CI; cover UI manually during release.
