---
id: TASK-BILL-05
title: POST /api/webhooks/stripe — signature + event dispatch
group: billing-subscription
status: ready
estimate: 5
dependencies: [TASK-BILL-02]
related_screens: []
related_adrs: [ADR-0017, ADR-0018]
created: 2026-04-22
---

# TASK-BILL-05 — Stripe webhook handler

## Goal

Ship the single source of truth for `public.subscriptions` mutations: a Route Handler that verifies Stripe signatures, dedupes by `stripe_event_id`, dispatches handlers per event type, and upserts subscription state using `updated_at`-guarded writes so out-of-order retries don't regress state.

## Scope

**In scope**
- `apps/web/src/app/api/webhooks/stripe/route.ts` — exports `POST` only.
- Signature verification via `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET`.
- Idempotency via `processed_webhook_events` (TASK-BILL-02).
- Event handlers:
  - `customer.subscription.created` — upsert row with initial `status`, `current_period_end`, `stripe_customer_id`, `stripe_subscription_id`, `user_id` from `metadata.userId`.
  - `customer.subscription.updated` — update `status`, `current_period_end`.
  - `customer.subscription.deleted` — set `status = 'canceled'`.
  - `invoice.paid` / `invoice.payment_succeeded` — set `status = 'active'`, refresh `current_period_end`.
  - `invoice.payment_failed` — set `status = 'past_due'`.
  - `payment_intent.succeeded` — informational; reconcile only if the matching subscription row is missing.
- Service-role Supabase client usage (RLS bypass) — scoped to this file only.
- `entitlements` jsonb set to `{ "speclyy": { "plan": "pro" } }` on any active-state write.
- Structured logging (event type, event id, userId, outcome).
- Return 200 for all handled + dedup cases; 400 on bad signature; 5xx only for unexpected infra failures (so Stripe retries).

**Out of scope**
- Reading subscription state — other tasks (`isPro()` helper in TASK-BILL-08).
- Reconciliation cron — listed in [`../../architecture/billing.md`](../../architecture/billing.md) § "Reconciliation"; separate task.
- Email notifications on payment failure — Stripe dunning covers it for MVP.

## Acceptance criteria

```gherkin
Scenario: Valid signature processes event
  Given a stripe-signature header produced by STRIPE_WEBHOOK_SECRET
  When the handler receives customer.subscription.created for a new userId
  Then a subscriptions row is upserted with user_id = metadata.userId
  And processed_webhook_events contains the event id
  And the response is 200

Scenario: Invalid signature
  Given a request with a wrong or missing stripe-signature
  When the handler runs
  Then it returns 400 "Invalid signature"
  And no DB writes occur

Scenario: Replay is a no-op
  Given processed_webhook_events already contains 'evt_123'
  When 'evt_123' arrives again
  Then no handler logic runs
  And the response is 200

Scenario: Out-of-order updates
  Given subscriptions.updated_at for user U is newer than the incoming event
  When an older customer.subscription.updated arrives
  Then the row is NOT overwritten (updated_at guard)
  And the response is 200

Scenario: invoice.paid activates
  Given the user has a subscription in 'incomplete' state
  When invoice.payment_succeeded arrives for that subscription
  Then subscriptions.status = 'active'
  And entitlements = { "speclyy": { "plan": "pro" } }

Scenario: invoice.payment_failed flips past_due
  Given a user's subscription is 'active'
  When invoice.payment_failed arrives
  Then subscriptions.status = 'past_due'

Scenario: subscription.deleted cancels
  When customer.subscription.deleted arrives
  Then subscriptions.status = 'canceled'

Scenario: Unknown event type
  When an event type not in the dispatch map arrives
  Then the handler logs it as info and returns 200
  And does not write to the DB

Scenario: Missing metadata.userId
  When an event arrives without metadata.userId (shouldn't happen post-TASK-BILL-03)
  Then the handler logs an error with the event id
  And returns 200 to prevent retry storms
  And emits an Axiom alert-worthy structured log
```

## Architecture references

- [`../../architecture/billing.md`](../../architecture/billing.md) § "Webhook handling" — authoritative handler shape, event taxonomy, idempotency, out-of-order strategy.
- [ADR-0018 — Payment surface](../../architecture/adr/0018-payment-surface.md) — `checkout.session.completed` is NOT handled; we use embedded Elements.
- [ADR-0017 — Subscription ownership](../../architecture/adr/0017-subscription-ownership.md) — `metadata.userId` is the attribution key.

## Implementation notes

- **Route export:**
  ```ts
  export const runtime = 'nodejs' // Stripe SDK needs Node; not edge
  export async function POST(req: Request) { … }
  ```
- **Raw body required** for signature verification. In App Router, `await req.text()` returns the raw body — use it directly, do not `req.json()` first.
- **Dispatch map:**
  ```ts
  const handlers: Record<string, (e: Stripe.Event) => Promise<void>> = {
    'customer.subscription.created': onSubscriptionUpsert,
    'customer.subscription.updated': onSubscriptionUpsert,
    'customer.subscription.deleted': onSubscriptionCanceled,
    'invoice.paid':               onInvoicePaid,
    'invoice.payment_succeeded':  onInvoicePaid,
    'invoice.payment_failed':     onInvoicePaymentFailed,
    'payment_intent.succeeded':   onPaymentIntentSucceeded,
  }
  ```
- **Upsert pattern** per [`../../architecture/billing.md`](../../architecture/billing.md) § "Out-of-order events":
  ```ts
  await db.insert(subscriptions).values({ userId, status, currentPeriodEnd, stripeCustomerId, stripeSubscriptionId, entitlements, ... })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: { status, currentPeriodEnd, updatedAt: new Date() },
      where: sql`subscriptions.updated_at < ${new Date()}`,
    })
  ```
  > **`subscriptions.user_id` carries a UNIQUE constraint**, added to the initial schema in [TASK-AUTH-02](../auth/TASK-AUTH-02-db-migration-auth-tables.md) — decided. Encodes the MVP invariant (one subscription per user, per [ADR-0017](../../architecture/adr/0017-subscription-ownership.md)) and is required for `onConflictDoUpdate(target: user_id)` to work. Drop it later if team billing ever introduces multi-sub users.
- **Entitlements.** On every state write, set `entitlements = { speclyy: { plan: 'pro' } }` when status is `active`; leave as-is otherwise. Future apps read the same column.
- **Service-role client** — imported from `createServiceRoleClient()` (TASK-AUTH-03). This is the only route that uses it in the billing group.
- **Logging.** Use structured logs (JSON); include `event.type`, `event.id`, `userId`, `subscriptionId`, `outcome`. Never log raw payloads (cardholder data may be present in nested structures).
- **Terminal-error handling.** Per [`../../architecture/billing.md`](../../architecture/billing.md) § "Webhook processing failures": non-transient errors log + alert + return 200 to avoid retry storms. Transient infra errors → 5xx so Stripe retries.

## Review notes

- **Signature check is the first thing.** Reviewer: any code before `constructEvent` that touches the body or environment is a bug.
- **Idempotency key is the STRIPE event id**, not the subscription ID. Easy to get wrong.
- **`updated_at` guard required on every upsert.** Without it, an out-of-order `past_due` after an `active` will downgrade state incorrectly.
- **Service-role boundary.** Confirm `createServiceRoleClient` is imported only here and in documented ops scripts — grep the PR.
- **Missing metadata.userId.** We trust our Server Action to always set it; a third-party app creating subscriptions against our account can't. Fail safely: log at error, 200, alert.
- **No `checkout.session.completed` handler.** If a reviewer suggests one, redirect to ADR-0018.
- **UNIQUE(user_id)** is part of the initial `subscriptions` schema (TASK-AUTH-02) — there is no prior data to violate it. Reviewer: confirm it's present before this handler merges.
- **Observability.** Each handler should emit one log line per event. Too noisy? Downshift unhandled events to `debug`.

## Test plan

- **Unit (per handler):** feed a crafted `Stripe.Event` object into the handler; assert the DB write performed. Use mocked service-role client.
- **Unit:** signature verification — craft a body and header with known secret; confirm happy + tampered paths.
- **Unit:** dedup path — pre-insert `processed_webhook_events`; run handler; assert no DB writes.
- **Unit:** out-of-order — existing row has newer `updated_at`; older event does not overwrite.
- **Integration (local `stripe listen` + `stripe trigger`):** run each supported event and assert the resulting `subscriptions` row shape.
- **Integration:** `stripe trigger invoice.payment_failed` on a seeded active sub → `status = 'past_due'`.
- **Manual:** deliberately corrupt the signature via curl; assert 400.
- **E2E coverage** (full Pro purchase → active) ships in [TASK-TEST-04](../testing/TASK-TEST-04-billing-e2e-suite.md).

## Open questions

- None. `UNIQUE(user_id)` on `subscriptions` is part of the initial schema in [TASK-AUTH-02](../auth/TASK-AUTH-02-db-migration-auth-tables.md) — encodes the MVP invariant and is required for `onConflictDoUpdate(target: user_id)`.
