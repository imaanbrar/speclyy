---
id: US-105
title: Onboarding — plan overview
epic: epic-01-auth-onboarding
persona: designer
priority: P0
status: ready
estimate: 2
dependencies: [US-104]
related_screens: ["2.4 Onboarding — Plan Overview"]
related_adrs: [ADR-0007]
created: 2026-04-22
---

# US-105 — Onboarding — plan overview

## Story

**As a** newly-signed-in designer
**I want to** see what's included in my Free plan and what Pro adds
**So that** I have honest expectations before I start building specs — without being asked to pay before I've used the product.

## Context

Step **4 of 4** in onboarding — the final step. **Informational only**, not a payment screen ([`mvp-decisions.md`](../../mvp-decisions.md) § 10, [`screen-inventory.md`](../../screen-inventory.md) § 2.4). The designer is already on Free; this screen sets expectations and shows them where the paywall will appear (PDF export). Completing this step finalises onboarding by stamping `onboarding_completed_at` — which is the trigger for `is_onboarded` to flip to `true` and middleware to stop redirecting them here.

## Acceptance criteria

```gherkin
Scenario: Designer reviews plan overview and enters the app
  Given I am authenticated, profile.market is set
  And I am on /onboarding/plan
  When I click "Go to dashboard →"
  Then profiles.onboarding_completed_at is set to NOW()
    And profiles.is_onboarded becomes true (generated column)
    And I am redirected to /projects
    And the projects dashboard renders the empty state (US-106)

Scenario: Designer expands the comparison via "Compare plans" link
  Given I am on /onboarding/plan
  When I click "Compare plans"
  Then a full Free vs Pro comparison renders inline (or in a modal — implementer's call)
    And the same plan rows are shown as on the marketing pricing page

Scenario: No upgrade CTA is presented at this step
  Given I am on /onboarding/plan
  Then I do NOT see "Upgrade to Pro" or "Subscribe" buttons
    And I do NOT see a billing interval toggle
    And I do NOT see Stripe Checkout
    And the only primary action is "Go to dashboard →"

Scenario: No Back button from final step
  Given I am on /onboarding/plan
  Then a Back button is NOT shown
  And reloading the page keeps me on /onboarding/plan (not earlier)

Scenario: Promo-redeemed user sees Pro status reflected
  Given I redeemed a promo code at sign-in (US-101)
    And my subscriptions.status is 'active'
  When I view /onboarding/plan
  Then the Free vs Pro table shows me as currently on Pro
    And the CTA still reads "Go to dashboard →"

Scenario: Progress indicator shows final step
  Given I am on /onboarding/plan
  Then the progress indicator shows "4 of 4"
```

## UX notes

- Screen: [`../../screen-inventory.md`](../../screen-inventory.md) § 2.4 Onboarding — Plan Overview.
- Heading: **"You're all set."**
- Subtext: **"You're on the Free plan — build unlimited specs and explore the product library. When you're ready to share your work, upgrade to Pro to unlock PDF export."**
- Free vs Pro comparison table — same rows as the marketing pricing page (single source of truth).
- **"Compare plans"** hyperlink — opens full comparison (modal or inline reveal).
- Primary CTA: **"Go to dashboard →"**.
- **No Back button.** **No upgrade prompt. No payment flow.**
- Progress indicator: **"4 of 4"**.

## Technical notes

- **Route:** `/onboarding/plan`.
- **Mutation:** Server Action sets `profiles.onboarding_completed_at = NOW()`. The `is_onboarded` column is `GENERATED ALWAYS AS (onboarding_completed_at IS NOT NULL) STORED` ([ADR-0007](../../architecture/adr/0007-auth-data-model.md)) — no separate write to a boolean.
- **Middleware effect:** after this Server Action, the next request hits middleware with `is_onboarded = true`, so all subsequent navigation skips the onboarding gate.
- **Plan comparison data:** keep the rows in a single shared component (e.g. `<PlanComparison />`) used here AND on the marketing pricing page — no copy/paste drift.
- **Promo-redeemed users:** the comparison must read live `subscriptions.status` and visually mark which plan is "your current plan" so the screen feels accurate, not stale.

## Test plan

- **E2E (Playwright):** click "Go to dashboard →" → assert `profiles.onboarding_completed_at` is set, `is_onboarded = true`, redirect to `/projects`.
- **E2E:** assert no upgrade / subscribe / billing toggle exists in the DOM at this step.
- **E2E:** promo-redeemed user — table shows current plan as Pro; CTA still reads "Go to dashboard →".
- **E2E:** middleware no longer routes the user to onboarding after this step (navigate to `/projects` directly).
- **Unit:** Server Action is idempotent — calling twice doesn't change `onboarding_completed_at` after first set.
- **Manual:** click "Compare plans" → confirm comparison expands; design parity with marketing pricing page.

## Out of scope

- Any payment / Stripe interaction — Stripe lives entirely in [Epic 8](../epic-08-billing-subscription/README.md), triggered from the PDF export paywall in [Epic 7](../epic-07-pdf-export/README.md).
- A/B testing different copy on this step — post-MVP analytics work.
- A "skip" or "remind me later" — there's nothing to skip; the screen is informational and one click long.

## Open questions

- Should the "Compare plans" reveal be a modal or inline expansion? Recommend inline expansion to avoid losing context, matches simple `<details>` semantics.
- Should we set `profiles.onboarding_completed_at` on page load (so a refresh doesn't bounce them to onboarding) or only on CTA click? Recommend: on CTA click, so we can measure onboarding completion accurately for product analytics later.
