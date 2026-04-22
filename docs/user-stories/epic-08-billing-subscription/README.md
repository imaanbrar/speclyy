# Epic 8 — Billing & Subscription

**Goal:** A Free user can see their plan, compare Free vs Pro, and upgrade with two clicks. A Pro user can manage billing without leaving the app for more than the Stripe Customer Portal handoff. Promo codes grant Pro access for a defined period without charging a card.

**Primary persona:** [Designer](../personas.md#designer-designer--primary)

## Stories (planned)

> Stories in this epic are not yet written. The table below is the planned decomposition — file paths and IDs are reserved.

| ID | Title | Priority | Status | Est |
|----|-------|----------|--------|-----|
| US-801 | View current plan badge in dashboard header (Free / Pro) | P0 | 🔲 draft | 1 |
| US-802 | Open Subscription & Billing screen with plan comparison | P0 | 🔲 draft | 2 |
| US-803 | Toggle billing interval (Monthly $37 / Annual $29/mo) | P0 | 🔲 draft | 1 |
| US-804 | Upgrade to Pro via Stripe Checkout (returns to app on success) | P0 | 🔲 draft | 5 |
| US-805 | Apply promo code to grant Pro access for a defined period | P1 | 🔲 draft | 3 |

**Total estimate:** 12 points

## Depends on

- [Epic 1](../epic-01-auth-onboarding/README.md) — authenticated session and `profiles.id` to associate with the Stripe customer.

## Unblocks

- [Epic 7 (PDF Export)](../epic-07-pdf-export/README.md) — the Free/Pro gate decision reads `subscriptions.status` to choose blurred preview (US-705) vs full download (US-704).

## Source documents

- [`../../mvp-decisions.md`](../../mvp-decisions.md) § 4 (Business model — Free is indefinite, paywall on PDF only), § 7 (Pricing — $37 monthly, $29/mo annual = 30% off, promo codes), § 10 (no payment at onboarding)
- [`../../screen-inventory.md`](../../screen-inventory.md) § 6.2 Subscription & Billing
- [`../../mvp-prd.md`](../../mvp-prd.md) — pricing + plan structure

## Architecture references

- [ADR-0007 — Auth data model: `subscriptions` table](../../architecture/adr/0007-auth-data-model.md) — schema for `status`, `stripe_customer_id`, `stripe_subscription_id`, `promo_code_id`
- [`../../architecture/billing.md`](../../architecture/billing.md) — Stripe Checkout + webhook flow, Customer Portal handoff
- [`../../architecture/security.md`](../../architecture/security.md) — Stripe webhook signature verification (mandatory before any DB write)

## Notes for implementers

- **No 7-day trial.** The latest [`mvp-decisions.md`](../../mvp-decisions.md) supersedes the older trial-based language in some ADRs. Free is indefinite. The only paywall trigger is PDF export (Epic 7).
- **Subscription state lives in the `subscriptions` table** ([ADR-0007](../../architecture/adr/0007-auth-data-model.md)), not in JWT claims. Stripe webhooks are the only writer; the app only reads.
- **Webhook signature verification is mandatory** ([`security.md`](../../architecture/security.md)). Tests must include a "rejected unsigned webhook" scenario.
- **Promo code grants** (US-805) update `subscriptions.status='active'` with `current_period_end` set to the grant's expiry. No Stripe customer is created until the user enters a paid plan, so promo grants are app-only state.
- **Pro Customer Portal** for self-serve billing changes is provided by Stripe — no UI to build beyond the "Manage billing" CTA.
