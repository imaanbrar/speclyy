---
id: TASK-ONB-05
title: Step 4 · Plan — Free / Pro selection
group: onboarding
status: ready
estimate: 3
dependencies: [TASK-ONB-04, TASK-BILL-03]
related_screens: ["2.4 Onboarding · Plan"]
related_adrs: [ADR-0017, ADR-0018]
created: 2026-04-22
---

# TASK-ONB-05 — Step 4 · Plan

## Goal

Final onboarding step. Two cards — **Free** (selected by default) and **Pro** with a monthly/annual toggle. The primary CTA's label and behavior depend on the selection: **"Continue with Free"** completes onboarding and routes to the Free Welcome screen; choosing Pro routes to the embedded Stripe Elements checkout (billing group).

## Scope

**In scope**
- Route: `apps/web/src/app/(onboarding)/onboarding/plan/page.tsx`.
- Two selectable cards: Free and Pro. Pro card contains a Monthly / Annual toggle with the annual-discount callout visible.
- Server Action `completeOnboarding()` — sets `profiles.onboarding_completed_at = now()`. Used by the Free path.
- On Pro selection, call `createProSubscription(interval)` (from TASK-BILL-03) and redirect to the checkout page (`/onboarding/checkout`, TASK-BILL-04). Onboarding is **NOT** marked complete here; billing's success handler does it.
- Back → `/onboarding/market`.

**Out of scope**
- The Stripe checkout page itself — TASK-BILL-04.
- Free Welcome screen — TASK-ONB-06.
- Promo codes at this step — promos apply inside Stripe Checkout / Elements (`allow_promotion_codes: true`); no custom field here.

## Acceptance criteria

```gherkin
Scenario: Continue with Free completes onboarding
  Given Free is selected (default)
  When I click "Continue with Free"
  Then profiles.onboarding_completed_at is set to now()
  And I am redirected to /welcome (Free Welcome, TASK-ONB-06)

Scenario: Select Pro → checkout
  Given I select the Pro card with interval = 'annual'
  When I click "Continue with Pro"
  Then createProSubscription('annual') is called
  And I am redirected to /onboarding/checkout (TASK-BILL-04) with the returned clientSecret
  And profiles.onboarding_completed_at remains NULL at this point

Scenario: Interval toggle
  Given Pro is selected
  When I toggle Annual ↔ Monthly
  Then the displayed price updates
  And the next Server Action uses the new interval

Scenario: Pro Server Action failure
  Given Stripe returns an error on createProSubscription
  When the Server Action throws
  Then an inline error appears on the plan step ("Couldn't start checkout. Try again.")
  And onboarding state is unchanged

Scenario: Revisit after Pro payment completes
  Given the user paid and returned, onboarding_completed_at was set by billing success
  When they somehow navigate back to /onboarding/plan
  Then the middleware / layout redirects them to /projects
```

## Architecture references

- [`../../architecture/billing.md`](../../architecture/billing.md) § "Checkout flow" — entry points include "Onboarding step 4 (Plan) — selecting Pro → `/onboarding/checkout`".
- [ADR-0018 — Payment surface](../../architecture/adr/0018-payment-surface.md) — embedded Elements, not hosted Checkout.
- [ADR-0017 — Subscription ownership](../../architecture/adr/0017-subscription-ownership.md) — per-user (not per-org).
- [`../../implementation-tasks/onboarding/_source-plan.md`](_source-plan.md) § "Design resolution · Onboarding — 4 steps" — Pro pricing ($29/mo annual, $37 monthly) is informational; actual values come from Stripe price IDs.

## Implementation notes

- **Free path completion is the ONLY place in this group** that writes `onboarding_completed_at`. Pro path defers completion to the billing success handler (TASK-BILL-06) so users who bail out of checkout remain able to complete onboarding on Free.
- **Pricing display.** Read from env-driven config, not hardcoded copy that could drift from Stripe. Acceptable approach: a server-side `getPlanDisplayConfig()` reading `STRIPE_PRICE_ID_*` price metadata or a static `PLAN_DISPLAY` object kept next to the Stripe env var definitions.
- **Server Action shape:**
  ```ts
  export async function continueOnboarding(formData: FormData) {
    const plan = formData.get('plan') // 'free' | 'pro'
    const interval = formData.get('interval') // 'monthly' | 'annual' | null
    if (plan === 'free') { await completeOnboarding(); redirect('/welcome') }
    const { clientSecret } = await createProSubscription(interval)
    cookies().set('speclyy_cs', clientSecret, {
      httpOnly: true, secure: true, sameSite: 'lax',
      path: '/onboarding/checkout', maxAge: 600, // 10 min, single-use
    })
    redirect('/onboarding/checkout')
  }
  ```
  **`clientSecret` hand-off is an HttpOnly cookie** (decided; matches TASK-BILL-04): `speclyy_cs`, 10-minute lifetime, `path=/onboarding/checkout`, `Secure`, `SameSite=Lax`. The checkout page reads it once server-side and clears it. Never pass via URL — a one-use secret in a query string can leak through Referer headers.
- **Error surface.** Stripe-side errors bubble to this page via the standard inline-error Server Action pattern.

## Review notes

- **`clientSecret` handling.** Reviewer: confirm the secret is not logged, not placed into `window.history`, and lives only in the HttpOnly cookie (never a URL / query string).
- **Free completion is irreversible.** Once `onboarding_completed_at` is set, middleware locks the user out of `/onboarding/*`. That's the intent, but it also means a double-click on "Continue with Free" must not produce two writes with different timestamps. Make the Server Action guarded: `WHERE onboarding_completed_at IS NULL`.
- **Pro path must not set `onboarding_completed_at`.** Belt-and-braces: billing's success page is the one-and-only writer for the Pro path.
- **Accessibility.** Card selection is a radio group; the interval toggle is a segmented control (`role="tablist"` or native `<input type="radio">`).
- **Copy.** Primary button label toggles between "Continue with Free" and "Continue with Pro" based on selection — review copy to match design.

## Test plan

- **Unit:** `continueOnboarding` dispatches correctly for `{plan: 'free'}` vs `{plan: 'pro', interval}`.
- **Unit:** `completeOnboarding` updates only `onboarding_completed_at`, guarded by `WHERE onboarding_completed_at IS NULL`.
- **Integration:** calling `completeOnboarding` twice results in one timestamp write, no error on the second.
- **Manual:** walk through both Free and Pro branches end-to-end on the local test project (Stripe test keys).
- **E2E coverage** ships in [TASK-TEST-03](../testing/TASK-TEST-03-onboarding-e2e-suite.md) (Free path) and [TASK-TEST-04](../testing/TASK-TEST-04-billing-e2e-suite.md) (Pro path).

## Open questions

- None. `clientSecret` hand-off is an HttpOnly cookie scoped to `/onboarding/checkout`, 10-minute lifetime, single-use — aligned with TASK-BILL-04.
