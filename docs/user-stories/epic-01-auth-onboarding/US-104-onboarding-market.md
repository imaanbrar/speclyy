---
id: US-104
title: Onboarding — select market
epic: epic-01-auth-onboarding
persona: designer
priority: P0
status: ready
estimate: 2
dependencies: [US-103]
related_screens: ["2.3 Onboarding — Your Market"]
related_adrs: [ADR-0007]
created: 2026-04-22
---

# US-104 — Onboarding — select market

## Story

**As a** newly-signed-in designer
**I want to** select my market (city)
**So that** Speclyy surfaces local supplier inventory and price/availability relevant to my projects.

## Context

Step **3 of 4** in onboarding. Speclyy's MVP markets are the four cities in the seed data plan ([`mvp-decisions.md`](../../mvp-decisions.md) § 3): Los Angeles, New York, Dallas, Calgary. The selected market drives which products are returned in library search ([Epic 3](../epic-03-product-search/README.md)) and which inventory is prioritised. Designers can change this later in Account Settings (US-903).

## Acceptance criteria

```gherkin
Scenario: Designer selects a market and proceeds
  Given I am authenticated, profile.studio_name is set
  And I am on /onboarding/market
  And no market card is selected
  When I click the "Los Angeles" card
    And I click "Next"
  Then profiles.market is updated to 'los_angeles'
    And I am redirected to /onboarding/plan

Scenario: Designer selects a different market before continuing
  Given I am on /onboarding/market
    And I previously clicked "New York"
  When I click "Dallas"
  Then "New York" is no longer selected
    And "Dallas" appears selected
    And profiles.market is NOT yet updated
  When I click "Next"
  Then profiles.market is updated to 'dallas'

Scenario: Designer tries to proceed without selecting a market
  Given I am on /onboarding/market
    And no market card is selected
  When I click "Next"
  Then a validation message appears
    And I remain on /onboarding/market

Scenario: Designer clicks Back
  Given I am on /onboarding/market
  When I click "Back"
  Then I am navigated to /onboarding/studio
    And my previously entered studio name is still populated

Scenario: Progress indicator shows correct step
  Given I am on /onboarding/market
  Then the progress indicator shows "3 of 4"

Scenario: Only the four MVP markets are offered
  Given I am on /onboarding/market
  Then I see exactly four selectable cards: Los Angeles, New York, Dallas, Calgary
  And no free-text "other city" option is shown
```

## UX notes

- Screen: [`../../screen-inventory.md`](../../screen-inventory.md) § 2.3 Onboarding — Your Market.
- Heading: **"Where are you based?"**
- Four single-select cards (radio-group semantics): Los Angeles, New York, Dallas, Calgary.
- Cards visually indicate selection state (highlight border, checkmark, etc.).
- Two CTAs: **"Back"** (left) and **"Next"** (right).
- Progress indicator: **"3 of 4"**.

## Technical notes

- **Route:** `/onboarding/market`.
- **DB CHECK constraint** ([ADR-0007](../../architecture/adr/0007-auth-data-model.md)): `profiles.market IN ('los_angeles', 'new_york', 'dallas', 'calgary')`. UI labels map to these enum values:
  - "Los Angeles" → `'los_angeles'`
  - "New York"    → `'new_york'`
  - "Dallas"      → `'dallas'`
  - "Calgary"     → `'calgary'`
- **Mutation:** Server Action updates `profiles.market` for `auth.uid()`. The CHECK constraint is the source of truth; client should not transmit the raw display string.
- **Library search wiring** (Epic 3) reads `profiles.market` to scope inventory — no work in this story, but this field becomes the input.

## Test plan

- **E2E (Playwright):** select Los Angeles → assert DB value `'los_angeles'` and redirect to `/onboarding/plan`.
- **E2E:** click between cards — only one is selected at a time.
- **E2E:** try to proceed with no selection → validation error.
- **E2E:** Back navigation preserves studio name.
- **Unit:** mapping function from display label → DB enum value covers all four markets.
- **Manual:** card hover, selected, and focus states are visually distinct.

## Out of scope

- "Other" / free-text market option — not in MVP scope ([`mvp-decisions.md`](../../mvp-decisions.md) § 3 limits to the four markets).
- Multiple markets per designer (e.g. studios that work in two cities) — post-MVP.
- Changing market post-onboarding — covered by US-903 in Epic 9.

## Open questions

- When a designer changes market via Account Settings (US-903), should past projects' library results retroactively change? Recommend: no — past projects keep their current items; only new searches are scoped to the new market.
