# ADR-0017: Subscription ownership — per-user, not per-studio

- **Status:** Accepted
- **Date:** 2026-04-22

## Context

[ADR-0016](0016-onboarding-data-model-revision.md) promotes `studios` to a first-class entity with a many-profiles relationship, in anticipation of teammate invites. This raises a natural question: should a Pro subscription belong to the **studio** (one sub covers everyone) or the **user** (every member buys their own)?

## Decision

**`subscriptions.user_id` stays.** Each designer has their own subscription. When teammate invites ship, each invited seat will create its own subscription row; a per-seat discount (handled as a Stripe coupon/promo code) provides the group pricing.

## Rationale

**Simpler gating.** The export paywall asks one question — "does this user have `status = active`?" — and reads from one row. A per-studio model would require answering "does any active member of this studio have Pro?" and handling seat caps, role checks, and billing-role transitions.

**Aligns with Stripe's customer model.** Stripe's primary identity is the customer (email-backed). Mapping one Stripe customer per user keeps the webhook handler's identity resolution trivial (`metadata.userId` → row).

**Team discount is a pricing lever, not a schema choice.** If teammates should be cheaper, that lives in Stripe (coupon on invited-seat subscriptions) not in the schema. Keeps schema options open.

**Avoids billing-role ambiguity.** A shared studio subscription forces decisions about who owns the card, who sees invoices, what happens when the billing owner leaves. Per-user sidesteps all of that.

## Consequences

**Positive**
- Gate check stays a single-row read by `user_id`.
- Stripe webhook handlers map 1:1 user ↔ customer ↔ subscription.
- Onboarding completes without waiting on any studio-level billing setup.
- Billing-owner churn does not orphan the studio's access.

**Negative**
- A studio with five Pro designers holds five Stripe subscriptions. Pricing must account for this via a per-seat coupon rather than a flat "team plan" price.
- No shared "team plan" SKU in Stripe — each member's renewal date is independent. Acceptable for v1; revisit if churn analytics need "team-level" aggregation.
- Studio-level features (shared letterhead, brand kit) live on `studios` even though billing lives on `profiles`. Not a problem, just worth naming.

## Alternatives considered

- **`subscriptions.studio_id`, one row per studio** — Rejected. Forces billing-owner role, seat-cap logic, and complicates leave/rejoin. Team discount can be achieved without this.
- **Hybrid — allow both, per studio choice** — Rejected. Doubles the gating code paths for no near-term win.
- **Defer the question; use per-user now, migrate later** — That is effectively this ADR, but formalized now so we do not accumulate studio-scoped features that assume shared billing.

## References

- [ADR-0016](0016-onboarding-data-model-revision.md) — studios entity
- [`../billing.md`](../billing.md) — subscription model
