---
id: US-103
title: Onboarding — studio name
epic: epic-01-auth-onboarding
persona: designer
priority: P0
status: ready
estimate: 2
dependencies: [US-102]
related_screens: ["2.2 Onboarding — Studio Name"]
related_adrs: [ADR-0007]
created: 2026-04-22
---

# US-103 — Onboarding — studio name

## Story

**As a** newly-signed-in designer
**I want to** enter my studio name
**So that** it appears on the spec sheets I export for clients and trades.

## Context

Step **2 of 4** in onboarding. The studio name is rendered in the PDF header next to the project info ([`screen-inventory.md`](../../screen-inventory.md) § 5.2). Solo designers can enter their own name here — the field is freeform, not validated against a real entity. The user can return and change this later via Account Settings (US-902).

## Acceptance criteria

```gherkin
Scenario: Designer fills in studio name and proceeds
  Given I am authenticated, profile.first_name and last_name are set
  And I am on /onboarding/studio
  When I enter "Patel Design Co." in the studio name field
    And I click "Next"
  Then profiles.studio_name is updated to "Patel Design Co."
    And I am redirected to /onboarding/market

Scenario: Designer tries to proceed with studio name empty
  Given I am on /onboarding/studio
    And studio name is empty
  When I click "Next"
  Then validation error appears under the field
    And I remain on /onboarding/studio
    And no profiles update occurs

Scenario: Designer clicks Back to revise name
  Given I am on /onboarding/studio
  When I click "Back"
  Then I am navigated to /onboarding/name
    And my previously entered name is still populated in the form

Scenario: Designer leaves and resumes
  Given I completed US-102 but not US-103
  When I sign in again
  Then I land on /onboarding/studio (not earlier)

Scenario: Progress indicator shows correct step
  Given I am on /onboarding/studio
  Then the progress indicator shows "2 of 4"
```

## UX notes

- Screen: [`../../screen-inventory.md`](../../screen-inventory.md) § 2.2 Onboarding — Studio Name.
- Heading: **"What's your studio called?"**
- Single text field, full-width.
- Two CTAs: **"Back"** (left) and **"Next"** (right).
- Progress indicator: **"2 of 4"**.
- Helper microcopy under the field (recommended): "This appears on your exported spec sheets. You can change it later in Account Settings."

## Technical notes

- **Route:** `/onboarding/studio`.
- **Mutation:** Server Action updates `profiles.studio_name` for `auth.uid()`.
- **Back navigation:** preserves form state when returning to US-102 — re-render with `defaultValues` from `profiles`.
- **Resume routing logic:** middleware walks the onboarding steps in order; first step where the corresponding `profiles` field is NULL/empty is the destination. After this step, `profiles.studio_name IS NOT NULL` advances the user to US-104.

## Test plan

- **E2E (Playwright):** fill studio name → assert redirect to `/onboarding/market` and DB state.
- **E2E:** empty studio name → validation error, no DB update.
- **E2E:** Back navigation preserves the previously entered first/last name.
- **E2E:** mid-onboarding resume from US-103 lands on US-103, not US-102.

## Out of scope

- Studio logo upload — MVP+1 ([`screen-inventory.md`](../../screen-inventory.md) § 5.2 — "no designer logo in MVP").
- Verifying or claiming a real studio entity (not a feature of MVP).
- Multi-studio support / switching between studios — post-MVP team accounts.

## Open questions

- Maximum length? Recommend 200 chars to allow long studio names ("Patel Design Co. Architecture & Interiors").
