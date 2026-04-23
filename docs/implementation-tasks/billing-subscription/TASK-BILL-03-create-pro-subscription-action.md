---
id: TASK-BILL-03
title: createProSubscription Server Action
group: billing-subscription
status: ready
estimate: 3
dependencies: [TASK-BILL-01, TASK-BILL-02]
related_screens: []
related_adrs: [ADR-0017, ADR-0018]
created: 2026-04-22
---

# TASK-BILL-03 — `createProSubscription` Server Action

## Goal

Ship the server-side primitive that takes a user from "I picked Pro, interval X" to a Stripe `Subscription` in `incomplete` state with a `client_secret` the browser can confirm via `PaymentElement`. The DB is not written here — that happens when the matching webhook arrives (TASK-BILL-05).

## Scope

**In scope**
- `apps/web/src/app/(billing)/billing/actions.ts` exporting `createProSubscription(interval: 'monthly' | 'annual')`.
- Stripe customer lookup (reuse existing) or creation.
- Subscription creation with `payment_behavior: 'default_incomplete'` and expanded `latest_invoice.payment_intent`.
- Return `{ clientSecret, subscriptionId }`.
- Typed Stripe SDK client (singleton module).

**Out of scope**
- The checkout UI — TASK-BILL-04.
- DB writes — the webhook handler owns `subscriptions` inserts.
- Portal Server Action — TASK-BILL-07.
- Updating an existing active subscription — post-MVP.

## Acceptance criteria

```gherkin
Scenario: New customer, new subscription
  Given a Pro user has never been in Stripe before
  When createProSubscription('annual') is called
  Then stripe.customers.create is called with { email, metadata.userId }
  And stripe.subscriptions.create is called with the annual price, payment_behavior = 'default_incomplete'
  And the returned object contains a non-empty clientSecret and subscriptionId

Scenario: Existing customer reused
  Given the user already has subscriptions.stripe_customer_id persisted
  When createProSubscription('monthly') is called
  Then stripe.customers.create is NOT called
  And the subscription uses the existing customer

Scenario: Unauthenticated call is rejected
  Given supabase.auth.getUser() returns null
  When the Server Action is invoked
  Then it throws (or returns an error shape) before calling Stripe
  And no Stripe resource is created

Scenario: Stripe failure surfaces cleanly
  Given stripe.subscriptions.create throws
  When the Server Action propagates the error
  Then no orphaned customer or half-state is left (customer may exist; subscription does not)
  And the caller receives a typed error message suitable for inline display

Scenario: Existing ACTIVE subscription
  Given the user already has subscriptions.status = 'active'
  When createProSubscription is called (accidentally)
  Then the action short-circuits with a typed "already_subscribed" error
  And does not create a second Stripe subscription
```

## Architecture references

- [`../../architecture/billing.md`](../../architecture/billing.md) § "Checkout flow" — the `createProSubscription` reference implementation is quoted verbatim there; this task ships that code path.
- [ADR-0018 — Payment surface](../../architecture/adr/0018-payment-surface.md) — why embedded Elements (and therefore a server-side Subscription create) instead of Checkout Sessions.
- [ADR-0017 — Subscription ownership](../../architecture/adr/0017-subscription-ownership.md) — `metadata.userId` attribution.

## Implementation notes

- **File layout:**
  - `apps/web/src/lib/billing/stripe.ts` — lazy singleton exporting the typed `Stripe` client using `STRIPE_SECRET_KEY`. `server-only` import.
  - `apps/web/src/lib/billing/plans.ts` — interval → `priceId` map (introduced in TASK-BILL-01).
  - `apps/web/src/app/(billing)/billing/actions.ts` — `createProSubscription`.
- **Customer lookup.** Read `subscriptions.stripe_customer_id` for the user. If present, reuse. If absent, `stripe.customers.create({ email, metadata: { userId } })`. Do **not** write the customer ID to `subscriptions` here — let the webhook do it on `customer.subscription.created` to keep a single writer.
- **Stripe subscription creation:** match the billing.md snippet exactly:
  ```ts
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
    metadata: { userId },
  })
  const pi = (subscription.latest_invoice as Stripe.Invoice).payment_intent as Stripe.PaymentIntent
  return { clientSecret: pi.client_secret!, subscriptionId: subscription.id }
  ```
- **Already-subscribed short-circuit.** Read `subscriptions.status` for the user; if `'active'`, throw a typed `AlreadySubscribedError`. This protects against double-charging if the plan screen misfires.
- **Error types.** Export a small discriminated union `BillingError = 'unauthenticated' | 'already_subscribed' | 'stripe_error'` so the UI can map to copy without parsing Stripe messages.
- **Logging.** Log subscription ID and userId on success at info level; do NOT log `clientSecret` or card details.

## Review notes

- **No DB write.** Reviewers: confirm this file does not call `.from('subscriptions').insert(…)`. The invariant "webhooks own subscription writes" is brittle and this is the most tempting place to violate it.
- **`server-only` import** on the Stripe client module. Confirm no Client Component imports `billing/stripe`.
- **Customer dedup.** If a user retries after a failure, we must reuse the Stripe customer or we'll leak ghost customers. Integration test this.
- **`metadata.userId` present on both** the customer and the subscription. The webhook uses it as the authoritative user-ID; missing metadata breaks webhook routing.
- **No sensitive data in thrown errors.** Strip Stripe's internal IDs from the message surfaced to the UI.
- **Amount assumptions** must match Stripe. If `STRIPE_PRICE_ID_PRO_ANNUAL` points at a price that isn't `recurring.interval = year`, the subscription creation will still succeed but billing is wrong. Add a boot-time assertion (or a startup check) that the configured price IDs have the expected intervals.

## Test plan

- **Unit:** customer-lookup-vs-create branch based on presence of `stripe_customer_id`.
- **Unit:** `AlreadySubscribedError` thrown when `status='active'`.
- **Integration (with Stripe test keys):** call the action → assert a real Stripe subscription exists in `incomplete` state with the expected `metadata.userId`.
- **Integration:** call twice rapidly without a webhook completing — second call creates a **new** Stripe subscription (decided). The prior `incomplete` auto-expires after 23h via Stripe's `incomplete_expired` sweep.
- **Manual:** trigger via a throwaway page or a test invocation; read the `clientSecret` and confirm a `PaymentElement` can mount.
- **E2E coverage** ships in [TASK-TEST-04](../testing/TASK-TEST-04-billing-e2e-suite.md).

## Open questions

- None. Retries always create a fresh Stripe subscription; stale `incomplete` ones auto-expire.
