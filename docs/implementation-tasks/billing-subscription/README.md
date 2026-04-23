# Billing & Subscription

**Goal.** Take a user from "I want Pro" to an `active` Stripe subscription that unlocks the Pro feature set (currently: PDF export + shareable link). Every state transition — initial purchase, renewal, payment failure, cancel — is driven by Stripe webhooks into the `subscriptions` table so the app's access checks are always reading ground truth.

**Outcome.** Pro entry points (onboarding Step 4, export paywall, account-settings upgrade CTA) share a single checkout surface. Free users remain indefinitely functional; the only Pro-gated actions are PDF export and shareable-link export.

## Tasks

| ID | Title | Priority | Status | Est | Depends on |
|----|-------|----------|--------|-----|------------|
| [TASK-BILL-01](TASK-BILL-01-stripe-provisioning.md) | Stripe account + product seeding + env wiring | P0 | 🔜 ready | 2 | — |
| [TASK-BILL-02](TASK-BILL-02-webhook-events-table.md) | Initial schema — `processed_webhook_events` | P0 | 🔜 ready | 1 | TASK-AUTH-02 |
| [TASK-BILL-03](TASK-BILL-03-create-pro-subscription-action.md) | `createProSubscription` Server Action | P0 | 🔜 ready | 3 | TASK-BILL-01, TASK-BILL-02 |
| [TASK-BILL-04](TASK-BILL-04-checkout-elements-page.md) | `/onboarding/checkout` — embedded Stripe Elements | P0 | 🔜 ready | 3 | TASK-BILL-03 |
| [TASK-BILL-05](TASK-BILL-05-stripe-webhook-handler.md) | `POST /api/webhooks/stripe` handler | P0 | 🔜 ready | 5 | TASK-BILL-02 |
| [TASK-BILL-06](TASK-BILL-06-pro-success-screen.md) | Pro Success screen + completion | P0 | 🔜 ready | 2 | TASK-BILL-04, TASK-BILL-05 |
| [TASK-BILL-07](TASK-BILL-07-customer-portal.md) | Customer portal Server Action + entry | P1 | 🔜 ready | 2 | TASK-BILL-01 |
| [TASK-BILL-08](TASK-BILL-08-paywall-gate-and-modal.md) | Export paywall — `isPro` helper + blurred-preview modal | P0 | 🔜 ready | 3 | TASK-BILL-05 |

**Total estimate:** 21 points.

**E2E coverage** ships separately in [TASK-TEST-04 — Billing E2E suite](../testing/TASK-TEST-04-billing-e2e-suite.md).

## Depends on

- **Auth group** — `auth.uid()`, `profiles`, `subscriptions` table, middleware.
- **Onboarding group** — Step 4 is the primary entry point; Pro Success screen finalizes onboarding for Pro users.

## Unblocks

- **PDF Export group** — consumes the `isPro()` helper and the paywall modal from TASK-BILL-08.
- **Account Settings group** — "Manage billing" link uses the portal Server Action from TASK-BILL-07.

## Source documents

- [`../../architecture/billing.md`](../../architecture/billing.md) — authoritative for the entire subsystem.
- [ADR-0017 — Subscription ownership](../../architecture/adr/0017-subscription-ownership.md) — per-user (not per-org) for MVP.
- [ADR-0018 — Payment surface](../../architecture/adr/0018-payment-surface.md) — embedded Stripe Elements (not hosted Checkout).
- [`../../mvp-decisions.md`](../../mvp-decisions.md) § 4 (plans), § 10 (Free indefinite, no trial).
- [`../onboarding/_source-plan.md`](../onboarding/_source-plan.md) § "Design resolution · Onboarding — 4 steps · Plan" and § "Billing".

## Invariants

- **Service-role key is used only inside the webhook handler and inside server-only ops scripts.** Never imported from any route, Server Action, or Client Component.
- **All subscription writes go through webhooks.** Server Actions may *create* a Stripe subscription (`createProSubscription`), but the DB row is only persisted by the webhook handler in response to the `customer.subscription.created` event.
- **Idempotent handlers.** Every event processor checks `processed_webhook_events` first and is safe to replay.
- **No trial.** `trial_ends_at` is not a column; do not re-introduce it.
- **No plan-switching in MVP.** Monthly ↔ annual via the portal (cancel + re-subscribe). Plan switching within the app is post-MVP.

## Cross-cutting notes

- **Test mode default.** Every env (local, preview, staging) uses Stripe **test** keys. Production is the only deployment that touches live keys. The wiring in TASK-BILL-01 has to make this foot-gun-proof.
- **Pricing display.** Do not hardcode `$29/mo`; derive from the Stripe price objects or a single small config file next to the env var defs. Otherwise UI and Stripe drift silently.
- **Webhook delivery is unordered.** All handlers use `updated_at`-guarded upserts per [`../../architecture/billing.md`](../../architecture/billing.md) § "Out-of-order events".
