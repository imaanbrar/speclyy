---
id: US-102
title: Onboarding — your name
epic: epic-01-auth-onboarding
persona: designer
priority: P0
status: ready
estimate: 2
dependencies: [US-101]
related_screens: ["2.1 Onboarding — Your Name"]
related_adrs: [ADR-0007]
created: 2026-04-22
---

# US-102 — Onboarding — your name

## Story

**As a** newly-signed-in designer
**I want to** enter my first and last name
**So that** Speclyy can personalise my workspace and use my name on collaborative surfaces.

## Context

Step **1 of 4** in the onboarding flow ([`mvp-decisions.md`](../../mvp-decisions.md) § 10). The first thing the designer sees after Google sign-in. Both fields are required to advance — partial entries can't proceed, but the user can leave the page entirely (their session persists; they'll resume here on next sign-in).

## Acceptance criteria

```gherkin
Scenario: Designer fills in both name fields and proceeds
  Given I am authenticated and is_onboarded = false
  And I am on /onboarding/name
  When I enter "Sara" in first name
    And I enter "Patel" in last name
    And I click "Next"
  Then profiles.first_name is updated to "Sara"
    And profiles.last_name is updated to "Patel"
    And I am redirected to /onboarding/studio

Scenario: Designer tries to proceed with first name empty
  Given I am on /onboarding/name
    And first name is empty
    And last name is "Patel"
  When I click "Next"
  Then validation error appears under the first name field
    And I remain on /onboarding/name
    And no profiles update occurs

Scenario: Designer tries to proceed with last name empty
  Given I am on /onboarding/name
    And first name is "Sara"
    And last name is empty
  When I click "Next"
  Then validation error appears under the last name field
    And I remain on /onboarding/name

Scenario: Designer leaves and returns mid-onboarding
  Given I completed US-102 with first_name="Sara", last_name="Patel"
  And I closed the browser before completing US-103
  When I sign in again
  Then I am routed to /onboarding/studio (not /onboarding/name)
    And my saved name is not asked again

Scenario: Progress indicator shows correct step
  Given I am on /onboarding/name
  Then the progress indicator shows "1 of 4"
```

## UX notes

- Screen: [`../../screen-inventory.md`](../../screen-inventory.md) § 2.1 Onboarding — Your Name.
- Heading: **"What's your name?"**
- Two text fields, side-by-side on desktop, stacked on mobile: First name, Last name.
- Primary CTA: **"Next"** (right-aligned).
- No Back button — this is the first step.
- Progress indicator: **"1 of 4"** (matches steps US-102, US-103, US-104, US-105).

## Technical notes

- **Route:** `/onboarding/name`. Public to authenticated, non-onboarded users only — middleware gate per [ADR-0007](../../architecture/adr/0007-auth-data-model.md).
- **Mutation:** Server Action that updates `profiles.first_name` and `profiles.last_name` for the current `auth.uid()`. RLS policy `USING (id = auth.uid())` on `profiles`.
- **No Stripe customer creation here** — that happens at upgrade in Epic 8.
- **Onboarding resume routing:** middleware checks which onboarding fields are unset and routes to the first incomplete step. US-103 implementation needs the inverse: knowing this step is "complete" if both name fields are non-empty.

## Test plan

- **E2E (Playwright):** fill both fields → assert redirect to `/onboarding/studio` and DB state.
- **E2E:** empty first name → assert validation error and no DB update.
- **E2E:** empty last name → same.
- **E2E:** mid-onboarding resume — sign out after this step, sign back in, land on `/onboarding/studio`.
- **Unit:** Server Action validates required fields before writing to DB.

## Out of scope

- Editable display name separate from legal name (post-MVP).
- Title / pronouns / bio fields — not in MVP scope ([`screen-inventory.md`](../../screen-inventory.md) § 2.1 limits to first + last name).

## Open questions

- Maximum length on each field? Recommend 100 chars each (matches typical Postgres `text` usage with no perf concern at this scale, but prevents abuse).
