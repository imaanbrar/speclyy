---
id: US-EOO
title: <Imperative phrase, ≤8 words>
epic: epic-XX-<slug>
persona: designer            # designer | prospect | admin
priority: P0                 # P0 (must) | P1 (should) | P2 (could)
status: draft                # draft | ready | in-progress | done | blocked
estimate: 0                  # Fibonacci story points: 1, 2, 3, 5, 8
dependencies: []             # e.g. [US-101, US-202]
related_screens: []          # e.g. ["4.1 Project Overview", "4.2 Group View"]
related_adrs: []             # e.g. [ADR-0005, ADR-0006]
created: YYYY-MM-DD
---

# US-EOO — <Title>

## Story

**As a** <persona>
**I want to** <capability>
**So that** <benefit / outcome>.

## Context

<2–4 sentences. Why this matters now. Where it sits in the user's journey. Cite the
source decision (e.g. "mvp-decisions.md § 4") if non-obvious. Keep this section
short — implementation details belong in Technical notes, not here.>

## Acceptance criteria

```gherkin
Scenario: <Happy-path name>
  Given <pre-condition>
  When <user / system action>
  Then <observable outcome>
  And <additional outcome>

Scenario: <Edge case 1>
  Given <pre-condition>
  When <action>
  Then <expected behavior>

Scenario: <Edge case 2 — error / empty / partial>
  Given <pre-condition>
  When <action>
  Then <graceful failure mode>
```

> Aim for 2–5 scenarios per story. Cover the happy path first, then meaningful
> edges (empty state, error, permission denial, partial data). One scenario per
> distinct branch in behavior.

## UX notes

- Screen: [`../../screen-inventory.md`](../../screen-inventory.md) § X.Y `<Screen Name>`.
- <Element / interaction note — copy / button label / loading state / error placement>.
- <Link to design file or Figma frame if one exists, otherwise omit>.

## Technical notes

- <Reference to ADRs by ID, e.g. "Auth provider: Supabase Auth (ADR-0005)">.
- <Routes / endpoints / table names involved>.
- <RLS policy or middleware gate impact>.
- <Any explicit constraints from architecture docs (`../../architecture/<file>.md`)>.

## Test plan

- **E2E** (Playwright): <happy-path scenario name>.
- **E2E:** <one edge case>.
- **Unit:** <pure-function or middleware unit, if applicable>.
- **Manual:** <visual / cross-browser / OAuth-consent-style checks that don't automate well>.

## Out of scope

- <Explicit non-goal that a reader might assume is included — link to `../../roadmap.md` if it's a planned future feature>.
- <Another non-goal>.

## Open questions

- <Any unresolved design or technical question. If none, write "None.">.
