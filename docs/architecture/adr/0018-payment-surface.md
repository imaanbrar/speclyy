# ADR-0018: Payment surface — embedded Stripe Elements

- **Status:** Accepted
- **Date:** 2026-04-22
- **Supersedes:** the "Checkout flow" section of [`../billing.md`](../billing.md) that specified hosted Stripe Checkout.

## Context

The original billing plan used **Stripe Checkout** — a hosted page that Stripe renders; Speclyy redirects the user away, Stripe handles card entry, the user redirects back. Minimal PCI scope, zero UI work.

The onboarding & billing design shows the payment step rendered **inline in Speclyy's own UI**: card inputs, an order summary with annual-discount callout, brand-consistent typography. This is the Stripe **Elements** pattern — Stripe-hosted iframes for sensitive inputs, embedded in our page.

## Decision

Use **Stripe Elements** via `@stripe/stripe-js` + `@stripe/react-stripe-js`. The checkout screen is a Speclyy-rendered page that mounts the `PaymentElement` and confirms with Stripe using a server-created PaymentIntent (first charge) or SetupIntent + Subscription (to attach the card then start the sub).

Hosted Checkout remains the fallback for any future surface where brand consistency is not a requirement (e.g. admin tools, recovery links) — not a priority.

## Rationale

**The onboarding flow is the brand.** The design treats payment as the final onboarding beat, not a detour. A redirect to Stripe's domain breaks the editorial register the rest of the product works hard to establish.

**Elements has the same PCI posture as Checkout.** Card data enters Stripe-hosted iframes; Speclyy's servers never see raw PAN. We remain **SAQ A** — same scope as hosted Checkout. The "PCI cost" of Elements is often overstated.

**SCA / 3DS handled by Stripe.** `PaymentElement` + `stripe.confirmPayment()` routes SCA challenges through Stripe's own UI, identical to Checkout's handling.

**Customer portal is still hosted.** For cancel / update card / invoice history, we continue to use Stripe's hosted Billing Portal. No reason to reimplement what Stripe already ships, and those flows are low-brand-surface.

## Consequences

**Positive**
- Checkout matches the rest of the product visually.
- Order summary can show Speclyy-specific context (annual savings copy, teammate discounts later) without Stripe Checkout's template limits.
- Single page, no redirect round-trip.

**Negative**
- More client code than a redirect. Mitigation: `PaymentElement` is one component; most of the page is the order-summary UI which we'd render either way.
- We now bundle Stripe.js (~40KB gzip) on the checkout route. Acceptable — the route is lazy and only visited by users upgrading.
- Webhook handler unchanged, but the "checkout lifecycle" test matrix is different — `payment_intent.succeeded` / `setup_intent.succeeded` instead of `checkout.session.completed`. Test plan updated.

## Alternatives considered

- **Stripe Checkout (hosted)** — Rejected. Brand mismatch at the highest-stakes moment of the funnel.
- **Stripe Checkout in embedded mode** — Considered. Renders inside an iframe but still uses Stripe's layout; the design calls for a Speclyy-rendered order summary alongside the card form, which embedded Checkout does not accommodate well.
- **Roll our own card form** — Rejected outright. Pulls us into full PCI scope for no benefit.

## Consequences for [billing.md](../billing.md)

- Replace `stripe.checkout.sessions.create` in the "Checkout flow" section with a `PaymentIntent` + `Subscription` server action that returns a `client_secret`.
- Client calls `stripe.confirmPayment({ elements, confirmParams: { return_url } })`.
- Webhook event set shifts: `payment_intent.succeeded`, `invoice.paid`, `customer.subscription.created/updated/deleted` remain. `checkout.session.completed` drops.
- Success / cancel returns become routed to the Pro Success / plan step respectively.

## References

- [ADR-0016](0016-onboarding-data-model-revision.md), [ADR-0017](0017-subscription-ownership.md)
- [Stripe Elements — Subscriptions with Payment Element](https://stripe.com/docs/billing/subscriptions/build-subscriptions)
- [PCI SAQ A eligibility with Elements](https://stripe.com/docs/security/guide#validating-pci-compliance)
- [`../billing.md`](../billing.md) (to be updated in the same PR)
