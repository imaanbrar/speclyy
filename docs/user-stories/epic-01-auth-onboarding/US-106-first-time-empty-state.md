---
id: US-106
title: First-time empty state on dashboard
epic: epic-01-auth-onboarding
persona: designer
priority: P1
status: draft
estimate: 1
dependencies: [US-105]
related_screens: ["3.1 Projects List"]
related_adrs: []
created: 2026-04-22
---

# US-106 — First-time empty state on dashboard

## Story

**As a** designer who has just finished onboarding
**I want to** land on a clear, inviting empty state with one obvious next action
**So that** I'm not staring at a blank screen wondering what to do.

## Context

Lands here directly after US-105 ([`screen-inventory.md`](../../screen-inventory.md) § 3.1, [`user-flows.md`](../../user-flows.md) Supporting Flow). The empty state is shown whenever `projects.count(user_id = auth.uid()) = 0` — so it appears not just after onboarding but any time a designer happens to delete all their projects (e.g. starts fresh). The "Free plan" badge with a "See what's included →" link in the dashboard header gives ongoing transparency about the plan ([`mvp-decisions.md`](../../mvp-decisions.md) § 10).

## Acceptance criteria

```gherkin
Scenario: First-time onboarded designer sees empty state
  Given I just completed US-105 with no projects in my account
  When I land on /projects
  Then the dashboard header is visible (logo, account menu, plan badge)
  And the main content shows the empty state with copy "Create your first project"
  And a primary "New Project" CTA is shown
  And no project cards are rendered

Scenario: Plan badge reflects current plan
  Given I am on the Free plan with no active subscription
  When I view the dashboard
  Then the header shows a "Free plan" badge
  And the badge has a "See what's included →" link

Scenario: Promo-Pro user sees Pro badge instead
  Given I redeemed a promo code at sign-in (US-101) granting Pro
  When I view the dashboard for the first time
  Then the header shows a "Pro plan" badge (not Free)
  And the empty state copy and CTA are unchanged

Scenario: Empty state CTA opens the New Project modal
  Given I see the empty-state "New Project" CTA
  When I click it
  Then the New Project modal (3.2) opens
  And focus moves to the project name field

Scenario: Empty state disappears once I have a project
  Given I have just created a project via the modal
  When I return to /projects
  Then the empty state is no longer rendered
  And my project appears as a card

Scenario: Empty state returns if I delete all projects
  Given I had one project and deleted it
  When I view /projects
  Then the empty state is rendered again
```

## UX notes

- Screen: [`../../screen-inventory.md`](../../screen-inventory.md) § 3.1 Projects List.
- Empty state copy: **"Create your first project"** (per [`screen-inventory.md`](../../screen-inventory.md) § 3.1).
- Centered illustration or icon (placeholder OK for first pass).
- Primary CTA: **"+ New Project"** button.
- Header always shows: logo (left), account menu (right), plan badge near account menu.
- Plan badge: pill-style — `Free plan` (muted) or `Pro plan` (accent color), with "See what's included →" link.

## Technical notes

- **Route:** `/projects`.
- **Server Component:** queries `count(*) FROM projects WHERE user_id = auth.uid()`. RLS makes the `WHERE` redundant but defensive.
- **Plan badge data:** read live from `subscriptions.status` (`'active'`, `'trialing'` if ever introduced) → Pro; else Free.
- **"See what's included →"** link routes to `/billing` (the Subscription & Billing screen, US-802).
- **Empty state is presentational only** — no special routing or middleware. Just a conditional render.

## Test plan

- **E2E (Playwright):** complete onboarding → land on `/projects` → empty state with `+ New Project` CTA visible.
- **E2E:** plan badge reflects subscription status (Free vs Pro paths).
- **E2E:** click `+ New Project` from empty state → modal opens.
- **E2E:** create a project → empty state replaced with card.
- **Manual:** visual check for centering, spacing, and that the empty state isn't visible as a flash before the project list renders.

## Out of scope

- Onboarding tour / coachmarks — post-MVP UX polish.
- Sample / example project pre-loaded for new users — not in MVP, would conflict with the empty-state hook.
- Search / filter on the projects list — comes online when there are enough projects to need it.

## Open questions

- Should the "See what's included →" link open `/billing` or open a lightweight comparison modal? Recommend: `/billing` so the user reaches the actual upgrade surface, not a dead-end modal.
