---
id: TASK-ONB-04
title: Step 3 · Market — presets + "Somewhere else"
group: onboarding
status: ready
estimate: 2
dependencies: [TASK-ONB-03]
related_screens: ["2.3 Onboarding · Market"]
related_adrs: [ADR-0016]
created: 2026-04-22
---

# TASK-ONB-04 — Step 3 · Market

## Goal

Collect the designer's market as free text, seeded by four preset cards (Los Angeles, New York, Dallas, Calgary) plus a "Somewhere else" option that opens a free-text input. Also surface a "Nominate your city →" link so we capture demand for future launches.

## Scope

**In scope**
- Route: `apps/web/src/app/(onboarding)/onboarding/market/page.tsx`.
- Preset cards (radio-like): values stored verbatim as `'los_angeles' | 'new_york' | 'dallas' | 'calgary'`.
- "Somewhere else" card that, when selected, reveals a free-text input. Stored verbatim (trimmed) as whatever the user typed.
- "Nominate your city →" link — `mailto:` to a hello@ alias is acceptable for v1 (keep it simple; no tracking).
- Server Action `saveMarket(value)` that updates `profiles.market`.
- Back → `/onboarding/studio`. Continue → `/onboarding/plan`.

**Out of scope**
- Canonicalizing user-entered cities (normalization, geocoding) — post-MVP.
- City-based pricing / feature gating — out of scope; this field is advisory.

## Acceptance criteria

```gherkin
Scenario: Preset selection
  Given I select the "Los Angeles" card
  When I click Continue
  Then profiles.market = 'los_angeles'
  And I am redirected to /onboarding/plan

Scenario: Somewhere else — free text
  Given I select "Somewhere else" and type "Austin, TX"
  When I click Continue
  Then profiles.market = 'Austin, TX'
  And I am redirected to /onboarding/plan

Scenario: Somewhere else — empty
  Given I select "Somewhere else" but leave the input empty
  When I click Continue
  Then an inline error appears under the input
  And no DB write occurs

Scenario: Somewhere else — trim
  Given I type "  Austin  "
  When I submit
  Then profiles.market = 'Austin' (trimmed)

Scenario: Revisit with a canonical value
  Given my profile already has market = 'new_york'
  When I navigate back to /onboarding/market
  Then the "New York" preset is pre-selected

Scenario: Revisit with a free-text value
  Given profile.market = 'Austin, TX'
  When I navigate back to this step
  Then "Somewhere else" is selected and the input contains 'Austin, TX'
```

## Architecture references

- [`../../architecture/auth.md`](../../architecture/auth.md) § "Data model" — `profiles.market` is free text; no CHECK constraint.
- [ADR-0016 — Onboarding data model revision](../../architecture/adr/0016-onboarding-data-model-revision.md) — rationale for free-text storage and no separate `market_custom` column.
- [`../../implementation-tasks/onboarding/_source-plan.md`](_source-plan.md) § "Decisions (confirmed)" items 2, 5 — free text + "Continue" CTA (not "Open Speclyy").

## Implementation notes

- **Preset snake_case values** are the contract. The UI maps them to display strings; the DB sees `'los_angeles'`, `'new_york'`, `'dallas'`, `'calgary'` verbatim.
- **Revisit detection:** if `profiles.market` equals any preset value, show that card selected. Otherwise show "Somewhere else" with the stored text.
- **Zod schema:**
  ```ts
  const Market = z.union([
    z.enum(['los_angeles','new_york','dallas','calgary']),
    z.string().trim().min(1).max(80),
  ])
  ```
- **Server Action:** single `UPDATE profiles SET market = $1, updated_at = now() WHERE id = auth.uid()`.
- **"Nominate your city"** `href="mailto:hello@speclyy.com?subject=City%20nomination"` — no analytics yet.

## Review notes

- **No canonicalization.** Reviewer: confirm we aren't lowercasing or collapsing whitespace beyond `.trim()`. The product decision is to store exactly what the user typed.
- **Don't reintroduce the CHECK constraint.** Earlier ADRs had a market CHECK; it was explicitly dropped. If a reviewer flags "why is this column unrestricted?", point at ADR-0016.
- **Max length 80.** Prevents pathological inputs. Bump later if we see real longer strings; keep a bound for now.
- **Mailto vs a form.** Reviewer: mailto is fine for v1. If someone proposes a `/nominate` endpoint, defer to roadmap.
- **Accessibility:** cards behave like a radio group (`role="radiogroup"`, arrow-key navigation). The free-text input appears with `aria-expanded` semantics.

## Test plan

- **Unit:** `Market` schema — accepts each preset, accepts normal free-text, rejects empty / overlong / non-trimmed-empty.
- **Unit:** preset-vs-freetext pre-fill logic given each shape of persisted value.
- **Manual:** walk-through each branch. Verify the stored DB value matches what was typed.
- **E2E coverage** ships in [TASK-TEST-03](../testing/TASK-TEST-03-onboarding-e2e-suite.md).

## Open questions

- None.
