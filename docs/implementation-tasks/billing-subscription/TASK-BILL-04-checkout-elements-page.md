---
id: TASK-BILL-04
title: /onboarding/checkout — embedded Stripe Elements
group: billing-subscription
status: ready
estimate: 3
dependencies: [TASK-BILL-03]
related_screens: ["2.4a Onboarding · Checkout"]
related_adrs: [ADR-0018]
created: 2026-04-22
---

# TASK-BILL-04 — `/onboarding/checkout` page

## Goal

Render the embedded Stripe Elements checkout inline: Elements provider wrapping a `PaymentElement`, an order-summary pane with annual-discount callout, and a submit flow that calls `stripe.confirmPayment` with `return_url = /billing/success`. No redirect to Stripe's domain.

## Scope

**In scope**
- Route: `apps/web/src/app/(onboarding)/onboarding/checkout/page.tsx`.
- Client Component mounting `<Elements stripe={stripePromise} options={{ clientSecret }}>`.
- Server hand-off: `clientSecret` delivered from TASK-ONB-05 via **HttpOnly cookie** (decided), 10-minute lifetime, `path=/onboarding/checkout`, `Secure`, `SameSite=Lax`. The page reads it server-side, passes it to the Client Component, then deletes the cookie (single-use).
- Order summary: plan name, interval, price, annual-discount callout, total, renewal copy.
- Submit handler: `stripe.confirmPayment` with `return_url` set to `/billing/success`.
- Inline error surface from `confirmPayment`.
- Back link to `/onboarding/plan` (explicit — browser back also works).

**Out of scope**
- Server Action `createProSubscription` — TASK-BILL-03.
- `/billing/success` screen — TASK-BILL-06.
- Customer portal entry — TASK-BILL-07.
- DB writes on return — all driven by webhook.

## Acceptance criteria

```gherkin
Scenario: Checkout mounts with a valid clientSecret
  Given /onboarding/plan set a speclyy_cs cookie containing a valid clientSecret
  When I navigate to /onboarding/checkout
  Then Elements mounts and PaymentElement is visible
  And the order summary shows the correct interval and price

Scenario: Successful confirm
  Given PaymentElement is populated with Stripe test card 4242 4242 4242 4242
  When I click "Pay"
  Then stripe.confirmPayment is called with return_url = /billing/success
  And on success the browser navigates to /billing/success (Stripe redirect)

Scenario: Declined card
  Given I use Stripe test card 4000 0000 0000 0002
  When I click Pay
  Then stripe.confirmPayment returns an error
  And the inline error copy renders
  And I remain on /onboarding/checkout

Scenario: Missing / expired cookie
  Given I land on /onboarding/checkout with no speclyy_cs cookie
  When the page loads
  Then I am redirected to /onboarding/plan with an inline "Session expired — try again" error

Scenario: Cookie is single-use
  Given I successfully loaded the page once
  When I reload /onboarding/checkout
  Then the cookie has been cleared
  And the page redirects per the "missing cookie" rule

Scenario: Onboarded user visiting checkout
  Given I already have an active Pro subscription
  When I navigate to /onboarding/checkout
  Then I am redirected to /projects (no double-charge path)
```

## Architecture references

- [`../../architecture/billing.md`](../../architecture/billing.md) § "Checkout flow · Client" — reference `CheckoutForm` snippet.
- [ADR-0018 — Payment surface](../../architecture/adr/0018-payment-surface.md) — embedded Elements is the required surface.

## Implementation notes

- **Client-side bootstrap:**
  ```ts
  // apps/web/src/lib/billing/stripe-browser.ts
  import { loadStripe } from '@stripe/stripe-js'
  export const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
  ```
- **Page shape:**
  ```tsx
  // page.tsx — RSC
  export default async function Checkout() {
    const jar = cookies()
    const clientSecret = jar.get('speclyy_cs')?.value
    if (!clientSecret) redirect('/onboarding/plan?error=checkout_expired')
    jar.set('speclyy_cs', '', { maxAge: 0, path: '/onboarding/checkout' }) // single-use
    const active = await userHasActiveSub()
    if (active) redirect('/projects')
    return <CheckoutForm clientSecret={clientSecret} summary={await getPlanSummary()} />
  }
  ```
- **`CheckoutForm` is a Client Component** wrapping `<Elements options={{ clientSecret, appearance }}>` around `PaymentElement` + a `<button>` submitting via `stripe.confirmPayment`.
- **Appearance** — use Stripe's `appearance` API with a theme that matches Speclyy's design tokens. Don't ship raw Stripe chrome.
- **Summary values.** Read from the `plans.ts` config introduced in TASK-BILL-01. Do not re-query Stripe for display numbers on every render.
- **Pass `return_url`** including an absolute origin — Stripe requires it.

## Review notes

- **`clientSecret` is a one-use capability.** Reviewer: confirm the cookie is cleared on the first load and scoped to `path=/onboarding/checkout`.
- **Referrer leakage.** Setting `referrerPolicy="no-referrer"` on the `<meta>` tag or the navigation into this page is a belt-and-braces step; the cookie approach already avoids URL exposure, but consider adding the policy anyway.
- **Don't write to DB here.** All state comes from the webhook.
- **Active-sub guard.** Prevent a user who already subscribed from re-entering checkout. The cookie check catches most cases, but the explicit `userHasActiveSub` guard is what closes the gap when a user opens a stale tab.
- **Error copy.** Stripe returns user-safe error messages via `error.message` — display verbatim. Don't re-map except to append "Try a different card" for `card_declined`.
- **Mobile.** PaymentElement is responsive; verify layout on a 375px viewport.

## Test plan

- **Unit:** page redirect logic for missing cookie / active sub.
- **Unit:** summary-display derivation given `{interval, plans config}`.
- **Manual:** full flow with Stripe test card 4242 → return_url lands on `/billing/success`.
- **Manual:** declined card 4000 0000 0000 0002 → inline error, no navigation.
- **Manual:** 3DS card 4000 0025 0000 3155 → extra-auth flow completes.
- **Manual:** reload checkout → redirect-to-plan fires (single-use cookie).
- **E2E coverage** ships in [TASK-TEST-04](../testing/TASK-TEST-04-billing-e2e-suite.md).

## Open questions

- None. No "Save for later" / "Not now" exit button — browser back + the explicit **Back** link are enough.
