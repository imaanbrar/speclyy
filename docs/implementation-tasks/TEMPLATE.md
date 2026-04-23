---
id: TASK-GROUP-NN
title: <Imperative phrase, ≤8 words>
group: auth                      # auth | onboarding | billing-subscription | ...
status: planned                  # planned | ready | in-progress | done | blocked
estimate: 0                      # Fibonacci: 1, 2, 3, 5, 8
dependencies: []                 # e.g. [TASK-AUTH-01]
related_screens: []              # e.g. ["1.1 Sign-In"]
related_adrs: []                 # e.g. [ADR-0005, ADR-0006]
created: YYYY-MM-DD
---

# TASK-GROUP-NN — <Title>

## Goal

<1 paragraph. What we're shipping, and the user-facing or engineering outcome that justifies it. Link the source decision (e.g. `mvp-decisions.md § 4`) if non-obvious.>

## Scope

**In scope**
- <Bullet>
- <Bullet>

**Out of scope**
- <Bullet — link to `../../roadmap.md` if it's a planned future item>

## Acceptance criteria

```gherkin
Scenario: <Happy path>
  Given <pre-condition>
  When <action>
  Then <observable outcome>

Scenario: <Edge case>
  Given <pre-condition>
  When <action>
  Then <expected behavior>
```

## Architecture references

- [ADR-XXXX — Title](../../architecture/adr/XXXX-slug.md) — <why it matters here>
- [`../../architecture/<file>.md`](../../architecture/<file>.md) § <section> — <why>

## Implementation notes

- **Routes / endpoints:** …
- **Tables / migrations:** …
- **Env vars:** …
- **Libraries / client factories:** …
- **RLS / middleware gates:** …
- **Code shape:** sketch function signatures or file paths when it clarifies intent.

## Review notes

- <Security concern: e.g. validate `next` is internal path only>
- <Auth boundary: service-role key must not leak to client bundle>
- <Idempotency / retry safety>
- <Error surface: inline vs full-page vs toast>
- <Cookie flags / header values that must be verified in DevTools>

## Test plan

- **Unit:** …
- **Manual:** …
- **E2E coverage** ships separately in the matching [`testing/`](testing/) task — do NOT add Playwright specs to this task.

## Open questions

- <Unresolved item. If none, write "None.">
