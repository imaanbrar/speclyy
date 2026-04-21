# Billing

> **Status:** stub — outline only.

End-to-end architecture for Stripe billing: checkout, subscription lifecycle, webhooks, trial/lapse states, and failure handling.

## Scope

Authoritative doc for the billing subsystem. Other docs (auth, application, database) reference this for anything beyond column-level detail.

## Outline

### 1. Subscription model
- Plans, price IDs, trial length
- Mapping Stripe subscription states → `subscriptions` table states
- Source of truth: Stripe (webhooks reconcile DB)

### 2. Checkout flow
- Entry points (upgrade CTA, paywall)
- Stripe Checkout session creation (server action)
- Success / cancel return handling
- Idempotency key strategy

### 3. Customer portal
- Link generation
- What users can do (cancel, update card, switch plan)
- Post-portal reconciliation via webhooks

### 4. Webhook handling
- Endpoint(s) and auth (signature verification)
- Event taxonomy: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`
- Idempotency: event id dedup table
- Retry semantics + Stripe's own retries
- Out-of-order event handling

### 5. Trial + lapse states
- Trial start / end triggers
- Grace period on failed payment
- Downgrade to free tier: what gets locked

### 6. Promo codes / coupons
- How codes are issued
- Stripe coupon vs. promotion code
- Validation at checkout

### 7. Failure handling
- Webhook processing failures → DLQ / alerting
- Stripe API outages
- Reconciliation job (periodic sweep)

### 8. Observability
- Key metrics: MRR, churn, failed-payment rate, webhook lag
- Dashboards + alerts (link to [operations.md](operations.md))

### 9. Open questions
- Tax / Stripe Tax rollout
- Annual plans
- Team / seat billing

## Cross-references
- [auth.md](auth.md) — subscription gate in middleware
- [database.md](database.md) — `subscriptions` schema
- [security.md](security.md) — webhook signature + secrets handling
