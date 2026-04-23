---
id: TASK-BILL-01
title: Stripe account + product seeding + env wiring
group: billing-subscription
status: ready
estimate: 2
dependencies: []
related_screens: []
related_adrs: [ADR-0017, ADR-0018]
created: 2026-04-22
---

# TASK-BILL-01 — Stripe provisioning + env wiring

## Goal

Stand up the Stripe workspace, create the Pro product with monthly + annual prices, register the webhook endpoint, and wire the resulting secrets into local dev + Vercel — **test keys everywhere except production**. Document it so a second engineer can rebuild from scratch.

## Scope

**In scope**
- Stripe account (or workspace / environment) — decide live account org, enable test mode.
- Product: **Speclyy Pro**. Two recurring prices:
  - Monthly — $37/mo (USD).
  - Annual — $348/yr (USD), displayed as "$29/mo billed annually".
  - Capture their IDs for env vars.
- Customer portal configuration — enable cancel, update payment method, view invoices. **Disable plan switching** until multi-plan support lands.
- Webhook endpoint (test + live) pointed at `/api/webhooks/stripe` with events:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `payment_intent.succeeded`
- Env vars populated in Vercel (preview + prod) and `.env.local.example`:
  - `STRIPE_SECRET_KEY` — server only. **Never** `NEXT_PUBLIC_`.
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — safe in bundle.
  - `STRIPE_WEBHOOK_SECRET` — server only.
  - `STRIPE_PRICE_ID_PRO_MONTHLY` — server only (used by Server Action resolving `interval`).
  - `STRIPE_PRICE_ID_PRO_ANNUAL` — server only.
  - `NEXT_PUBLIC_APP_URL` — used for `return_url` on checkout and portal.
- Provisioning doc: `docs/architecture/operations/stripe-provisioning.md` (or appended to `architecture/operations.md`).

**Out of scope**
- Stripe Tax configuration — listed in [`../../architecture/billing.md`](../../architecture/billing.md) § "Open questions".
- Promo code creation — run-time admin task, not engineering.
- Checkout / portal UI — TASK-BILL-04 / -07.

## Acceptance criteria

```gherkin
Scenario: Prices resolve at runtime
  Given STRIPE_SECRET_KEY and STRIPE_PRICE_ID_PRO_* are set
  When I call stripe.prices.retrieve(STRIPE_PRICE_ID_PRO_MONTHLY)
  Then the response is a recurring USD price of 3700 cents

Scenario: Webhook endpoint is registered
  Given the Stripe dashboard webhook list
  Then /api/webhooks/stripe is listed for both test and live modes
  And the enabled events match the list above

Scenario: Env isolation
  Given a local or preview deploy
  Then STRIPE_SECRET_KEY starts with "sk_test_"
  And production and ONLY production uses "sk_live_"

Scenario: Provisioning doc is sufficient
  Given a new engineer follows docs/architecture/operations/stripe-provisioning.md
  When they rebuild the Stripe side of a sibling test environment
  Then they reach "webhook endpoint receives a test event" without asking questions
```

## Architecture references

- [`../../architecture/billing.md`](../../architecture/billing.md) § "Subscription model" (plans table) and § "Webhook handling" (event taxonomy).
- [ADR-0018 — Payment surface](../../architecture/adr/0018-payment-surface.md) — embedded Elements requires a server-side Subscription create (not hosted Checkout); we still need the Price IDs and webhook.
- [ADR-0017 — Subscription ownership](../../architecture/adr/0017-subscription-ownership.md) — metadata `userId` is how we attribute customer records.

## Implementation notes

- **Create the product via the Stripe dashboard** for visibility; capture IDs into env. (Programmatic seeding via a script is optional; if added, keep it idempotent.)
- **Webhook secret is per-endpoint**, not account-wide. Record the test secret and the live secret separately; both must reach env config.
- **Local development.** Use `stripe listen --forward-to localhost:3000/api/webhooks/stripe`. Document the exact command in the provisioning doc. The signing secret `stripe listen` prints is the local `STRIPE_WEBHOOK_SECRET`.
- **Keep price → display-text mapping in code**, not spread across templates. Suggest a single `apps/web/src/lib/billing/plans.ts` exporting:
  ```ts
  export const PLANS = {
    monthly: { priceId: process.env.STRIPE_PRICE_ID_PRO_MONTHLY!, amountMonthly: 37, label: '$37/mo' },
    annual:  { priceId: process.env.STRIPE_PRICE_ID_PRO_ANNUAL!,  amountMonthly: 29, label: '$29/mo billed annually' },
  } as const
  ```
- **Portal configuration saved in the dashboard** — no app code owns it. Snapshot the chosen settings in the provisioning doc so a future diff is detectable.

## Review notes

- **`NEXT_PUBLIC_` discipline.** Reviewers: grep the PR for `NEXT_PUBLIC_STRIPE_SECRET` or similar mistakes — rejection on sight.
- **Key-mode isolation.** Production deploy config must be the *only* place live keys appear. Verify Vercel env scoping (Production checkbox) is correct; a leaked `sk_live_*` in a preview env is a billing incident.
- **Webhook event list.** Must match TASK-BILL-05's handler coverage exactly. Adding a new event here without a handler turns into silent 500s retried by Stripe; removing one that the handler expects is a data-drift risk.
- **Provisioning doc is second-engineer-proof.** Reviewer reads through and asks if each step is followable cold.
- **Portal: plan switching disabled.** If the dashboard setting is on, the portal exposes a plan-switch UI we don't support. Verify disabled.

## Test plan

- **Manual:** run `stripe listen` locally, trigger `stripe trigger customer.subscription.created`, confirm the local webhook handler (once TASK-BILL-05 lands; stub for now) receives the event.
- **Manual:** on the Stripe dashboard, toggle between test and live mode and verify the webhook endpoint and prices exist in both.
- **Manual:** confirm `process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')` in preview, `sk_live_` in prod only.
- **Doc check:** second engineer follows the provisioning doc on a scratch Stripe test account.

## Open questions

- None. **Stripe Tax is deferred** — call this out explicitly in the provisioning doc so a future engineer knows it's intentional, but do not block this task.
