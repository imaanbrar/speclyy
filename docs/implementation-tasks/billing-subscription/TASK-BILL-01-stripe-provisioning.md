---
id: TASK-BILL-01
title: Stripe account + product seeding + env wiring
group: billing-subscription
status: ready
estimate: 3
dependencies: []
related_screens: []
related_adrs: [ADR-0017, ADR-0018]
created: 2026-04-22
---

# TASK-BILL-01 — Stripe provisioning + env wiring

## Goal

Stand up the Stripe workspace, create the Pro product with **all four** recurring prices (USD monthly, USD annual, CAD monthly, CAD annual), register the webhook endpoint, and wire the resulting secrets into local dev + Vercel — **test keys everywhere except production**. Document it so a second engineer can rebuild from scratch.

**Dashboard side: full multi-currency.** All four prices live on the same Speclyy Pro product from day one. The CAD prices sit unused by app code in this task — they're populated into env vars but [TASK-BILL-09](TASK-BILL-09-cad-pricing-expansion.md) is what wires them into `plans.ts`, the Server Action, the UI toggle, and the DB column. Splitting the dashboard work across two tasks would mean a second trip into Stripe weeks later for a 5-minute job; doing it in one session is the right shape.

**Code side: USD-only.** `plans.ts` reads only the `_USD` env vars and exposes a flat `{ monthly, annual }` shape. BILL-09 restructures to `{ USD: {…}, CAD: {…} }` and starts using the CAD env vars. The CAD env vars are present-but-unused at this stage; the type system makes that explicit.

This shape is **multi-currency-ready by design**: env vars are currency-suffixed (`_USD`, `_CAD`) from day one, and the `_USD` naming makes BILL-09 a pure addition (no rename, no refactor). Future markets (INR, AED) follow the same recipe — add prices in dashboard, add env vars, add a key to `PLANS`.

## Scope

**In scope**
- Stripe account (or workspace / environment) — decide live account org, enable test mode. Verify account country = **Canada** (see [`../../business/stripe-account.md`](../../business/stripe-account.md) § Account country).
- **Pre-Stripe paperwork** (real-world, blocks the dashboard side of this task):
  - **CRA federal GST/HST registration** filed → BN+RT0001 in hand. Required before Stripe Tax → Canada registration is meaningful. See [`../../business/stages.md`](../../business/stages.md) § Stage 1.
  - **W-8BEN-E** filed inside Stripe (Settings → Tax forms). Avoids 30% backup withholding on USD payouts. See [`../../business/tax-us.md`](../../business/tax-us.md) § W-8BEN-E.
- Product: **Speclyy Pro**. **Four** recurring prices on a single product, in both test and live mode:
  - Monthly USD — **$37.00 / month**.
  - Annual USD — **$348.00 / year** (= "$29/mo billed annually").
  - Monthly CAD — **CA$49.00 / month**. Tag with metadata `{ region: 'CA' }`.
  - Annual CAD — **CA$468.00 / year** (= "$39/mo CAD billed annually"; $39 × 12 = $468 exact). Tag with metadata `{ region: 'CA' }`.
  - Capture all four IDs for env vars.
- **Stripe Tax** — enable in dashboard (Tax → Settings → origin = Canada). Add the **Canada** registration entry with the CRA BN+RT0001. Do **not** add provincial PST/QST/RST or US-state registrations — those follow the reactive Stage-2 playbook in [`../../business/stages.md`](../../business/stages.md). Note: the `automatic_tax: { enabled: true }` flag on the Subscription create call is set in [TASK-BILL-03](TASK-BILL-03-create-pro-subscription-action.md), not here — this task only configures the dashboard.
- Customer portal configuration — enable cancel, update payment method, view invoices, update billing address. **Disable plan switching** (re-verify after every pricing change; adding new prices to a portal-enabled product can silently re-enable it).
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
  - `STRIPE_PRICE_ID_PRO_MONTHLY_USD` — server only.
  - `STRIPE_PRICE_ID_PRO_ANNUAL_USD` — server only.
  - `STRIPE_PRICE_ID_PRO_MONTHLY_CAD` — server only. **Populated now, used by BILL-09.** The var is present-but-unread by `plans.ts` in this task; populating it now means the dashboard work is done in one session.
  - `STRIPE_PRICE_ID_PRO_ANNUAL_CAD` — server only. Same.
  - `NEXT_PUBLIC_APP_URL` — used for `return_url` on checkout and portal.
- Provisioning doc: `docs/architecture/operations/stripe-provisioning.md`. Must include the **CRA registration prerequisite**, the dashboard sequence (account → banking → tax → branding → product → prices → portal → webhooks → activation), the **per-currency price IDs**, and a "Stage-1 deferrals" callout listing what's intentionally not done (provincial registrations, US-state registrations, EIN, MoR — cross-link to [`../../business/stages.md`](../../business/stages.md)).

**Out of scope**
- **App-side CAD wiring** — currency-keyed `PLANS`, currency-aware Server Action, currency detection, billing-address validation, `subscriptions.currency` column, help-doc. All in [TASK-BILL-09](TASK-BILL-09-cad-pricing-expansion.md). The CAD env vars are populated in this task but `plans.ts` doesn't read them yet.
- **Provincial sales-tax registrations (BC PST, SK PST, MB RST, QST)** — Stage 2 in [`../../business/stages.md`](../../business/stages.md). Reactive on first paying customer in province.
- **US-state sales-tax registrations** — pre-nexus; Stripe Tax shows $0 on US invoices, which is correct.
- Promo code creation — run-time admin task, not engineering.
- Checkout / portal UI — TASK-BILL-04 / -07.

## Acceptance criteria

```gherkin
Scenario: All four prices exist in both Stripe modes
  Given the Speclyy Pro product in Stripe
  Then it has exactly four active recurring prices in test mode
  And exactly four active recurring prices in live mode
  And the four prices are: USD monthly $37/mo, USD annual $348/yr, CAD monthly CA$49/mo, CAD annual CA$468/yr
  And the two CAD prices have metadata { region: 'CA' }

Scenario: USD prices resolve at runtime
  Given STRIPE_SECRET_KEY and STRIPE_PRICE_ID_PRO_*_USD are set
  When I call stripe.prices.retrieve(STRIPE_PRICE_ID_PRO_MONTHLY_USD)
  Then the response is a recurring USD price of 3700 cents

Scenario: CAD prices are populated in env even though code doesn't read them yet
  Given STRIPE_SECRET_KEY and STRIPE_PRICE_ID_PRO_*_CAD are set
  When I call stripe.prices.retrieve(STRIPE_PRICE_ID_PRO_MONTHLY_CAD)
  Then the response is a recurring CAD price of 4900 cents
  And app code (plans.ts) does NOT yet reference these vars (BILL-09 wires them)

Scenario: Env vars use the currency suffix
  Given the Vercel and .env.local.example env-var lists
  Then STRIPE_PRICE_ID_PRO_MONTHLY_USD, STRIPE_PRICE_ID_PRO_ANNUAL_USD, STRIPE_PRICE_ID_PRO_MONTHLY_CAD, STRIPE_PRICE_ID_PRO_ANNUAL_CAD all exist
  And no unsuffixed STRIPE_PRICE_ID_PRO_MONTHLY or STRIPE_PRICE_ID_PRO_ANNUAL exists

Scenario: plans.ts reads USD only at this stage
  Given apps/web/src/lib/billing/plans.ts
  Then PLANS.monthly and PLANS.annual are populated from the USD env vars
  And no CAD references exist (BILL-09 restructures to PLANS.USD.* / PLANS.CAD.*)

Scenario: Stripe Tax is enabled with CRA registration
  Given Stripe Tax → Settings shows origin = Canada
  And Stripe Tax → Registrations shows one entry: "Canada" with the CRA BN
  And no provincial or US-state registrations are present
  When a test invoice is generated for an Ontario billing address
  Then the invoice line items include HST 13%
  And a test invoice for a California billing address shows no tax line (correct, pre-nexus)

Scenario: W-8BEN-E is on file
  Given Settings → Tax forms in the Stripe dashboard
  Then W-8BEN-E shows status "Completed" with treaty claim Canada / Article VII
  And no 30% withholding flag is active on USD payouts

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
  And the doc's Stage-1-deferrals callout makes clear what is intentionally NOT done
```

## Architecture references

- [`../../architecture/billing.md`](../../architecture/billing.md) § "Subscription model" (plans table) and § "Webhook handling" (event taxonomy).
- [ADR-0018 — Payment surface](../../architecture/adr/0018-payment-surface.md) — embedded Elements requires a server-side Subscription create (not hosted Checkout); we still need the Price IDs and webhook.
- [ADR-0017 — Subscription ownership](../../architecture/adr/0017-subscription-ownership.md) — metadata `userId` is how we attribute customer records.

## Implementation notes

- **Order of operations** (paperwork ↔ dashboard):
  1. CRA GST/HST registration filed → BN+RT0001 in hand.
  2. Stripe account country verified = Canada; account details + banking + 2FA + branding done.
  3. Stripe Tax enabled, Canada registration entry added with the CRA BN+RT0001.
  4. W-8BEN-E filed in Stripe.
  5. Speclyy Pro product created; **all four prices** added (USD monthly, USD annual, CAD monthly, CAD annual).
  6. Customer Portal configured (plan switching OFF).
  7. Customer emails enabled (receipts, refunds, subscription updates).
  8. Webhook endpoint registered (test mode first).
  9. Env vars wired into `.env.local`, Vercel Preview/Development, Vercel Production.
  10. Activation banner resolved → flip to live → mirror products/prices/portal/webhook into live mode.
- **Create the product via the Stripe dashboard** for visibility; capture IDs into env. (Programmatic seeding via a script is optional; if added, keep it idempotent.)
- **Webhook secret is per-endpoint**, not account-wide. Record the test secret and the live secret separately; both must reach env config.
- **Local development.** Use `stripe listen --forward-to localhost:3000/api/webhooks/stripe`. Document the exact command in the provisioning doc. The signing secret `stripe listen` prints is the local `STRIPE_WEBHOOK_SECRET`.
- **Keep price → display-text mapping in code**, not spread across templates. Single `apps/web/src/lib/billing/plans.ts`, USD-only at this stage:
  ```ts
  // Stage: BILL-01 — USD only. BILL-09 restructures to currency-keyed PLANS.
  export const PLANS = {
    monthly: {
      priceId: process.env.STRIPE_PRICE_ID_PRO_MONTHLY_USD!,
      amountMonthly: 37,
      label: '$37/mo',
    },
    annual: {
      priceId: process.env.STRIPE_PRICE_ID_PRO_ANNUAL_USD!,
      amountMonthly: 29,
      label: '$29/mo billed annually',
    },
  } as const
  ```
  The CAD env vars (`STRIPE_PRICE_ID_PRO_*_CAD`) are populated in Vercel + `.env.local.example` but are NOT read by `plans.ts` in this task. BILL-09 changes the shape to `{ USD: {…}, CAD: {…} }` and starts reading them.
- **Portal configuration saved in the dashboard** — no app code owns it. Snapshot the chosen settings in the provisioning doc so a future diff is detectable.
- **Stripe Tax origin must be Canada** before adding the Canada registration entry. If origin is misconfigured, Stripe rejects the registration with a confusing error.

## Review notes

- **`NEXT_PUBLIC_` discipline.** Reviewers: grep the PR for `NEXT_PUBLIC_STRIPE_SECRET` or similar mistakes — rejection on sight.
- **Key-mode isolation.** Production deploy config must be the *only* place live keys appear. Verify Vercel env scoping (Production checkbox) is correct; a leaked `sk_live_*` in a preview env is a billing incident.
- **Webhook event list.** Must match TASK-BILL-05's handler coverage exactly. Adding a new event here without a handler turns into silent 500s retried by Stripe; removing one that the handler expects is a data-drift risk.
- **Provisioning doc is second-engineer-proof.** Reviewer reads through and asks if each step is followable cold.
- **Portal: plan switching disabled.** If the dashboard setting is on, the portal exposes a plan-switch UI we don't support. Verify disabled.
- **All four prices live, but only two read.** Reviewer confirms: (a) all four prices visible in Stripe dashboard (test + live), (b) all four IDs populated in Vercel env, (c) `plans.ts` references *only* the `_USD` env vars. The CAD env vars being populated-but-unused is intentional — BILL-09 picks them up without a Vercel touch.
- **CRA registration is a real-world prerequisite, not an engineering one.** Reviewer confirms Stripe Tax → Registrations panel shows a live (not test/empty) Canada entry before the live-mode mirror. If the CRA registration is still in flight, ship test-mode-only and gate the live-mode mirror until the registration lands.
- **W-8BEN-E status check.** Reviewer opens Settings → Tax forms and confirms "Completed" — not "Pending" or "Expired". A pending W-8BEN-E means the next USD payout will have 30% withheld.

## Test plan

- **Manual:** run `stripe listen` locally, trigger `stripe trigger customer.subscription.created`, confirm the local webhook handler (once TASK-BILL-05 lands; stub for now) receives the event.
- **Manual:** on the Stripe dashboard, toggle between test and live mode and verify all four prices, the webhook endpoint, the Canada Stripe Tax registration, and the W-8BEN-E status all exist in both modes (W-8BEN-E is account-wide, not per-mode).
- **Manual:** confirm `process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')` in preview, `sk_live_` in prod only.
- **Manual (Canadian tax dry-run):** in test mode, manually create a Subscription against `STRIPE_PRICE_ID_PRO_MONTHLY_CAD` for a customer with an Ontario billing address. Confirm the resulting test invoice shows HST 13% as a line item. (Even though `plans.ts` doesn't reference the CAD price ID yet, the price exists in Stripe and is exercisable from the dashboard.)
- **Manual (US-state pre-nexus check):** in test mode, create a Subscription against `STRIPE_PRICE_ID_PRO_MONTHLY_USD` for a California billing address. Confirm the test invoice shows **no tax line** — that's the correct pre-nexus posture.
- **Doc check:** second engineer follows the provisioning doc on a scratch Stripe test account. They reach "all four prices created, webhook endpoint receives a test event, Canadian tax computed correctly" without asking questions.

## Open questions

- None. **Provincial PST/QST/RST registrations** and **US-state registrations** are intentionally deferred per [`../../business/stages.md`](../../business/stages.md) — the provisioning doc must call this out explicitly so a future engineer knows it's a Stage-1 posture, not an oversight.
