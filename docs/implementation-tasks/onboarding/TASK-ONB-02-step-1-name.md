---
id: TASK-ONB-02
title: Step 1 · Name — first & last name
group: onboarding
status: ready
estimate: 2
dependencies: [TASK-ONB-01]
related_screens: ["2.1 Onboarding · Name"]
related_adrs: [ADR-0016, ADR-0019]
created: 2026-04-22
---

# TASK-ONB-02 — Step 1 · Name

## Goal

First onboarding step. Collect `first_name` and `last_name` (both required), show a "Signed in as {email}" helper so users know which Google / email they authenticated as, and persist the values before advancing to `/onboarding/studio`.

## Scope

**In scope**
- Route: `apps/web/src/app/(onboarding)/onboarding/name/page.tsx`.
- Two required text fields. Trim + length validation (2–40 chars each). Client + server validation.
- Server Action `saveName({ first_name, last_name })` that updates `profiles` by `id = auth.uid()`.
- "Signed in as {email}" line reading `user.email`.
- On success redirect to `/onboarding/studio`.
- Back button hidden on step 1 (no previous step).

**Out of scope**
- Pronouns, display name, avatar — post-MVP.
- Editing name from settings — account-settings group.

## Acceptance criteria

```gherkin
Scenario: Valid submit
  Given I am on /onboarding/name
  And I have no first_name / last_name persisted
  When I enter "Alice" / "Chen" and submit
  Then profiles.first_name = 'Alice' and last_name = 'Chen'
  And I am redirected to /onboarding/studio

Scenario: Pre-fill on revisit
  Given I already persisted first_name = 'Alice', last_name = 'Chen'
  And is_onboarded = false
  When I navigate back to /onboarding/name
  Then the inputs are pre-filled with 'Alice' and 'Chen'

Scenario: Required validation
  Given one field is empty
  When I submit
  Then the Server Action rejects with a field-level error
  And no DB write occurs

Scenario: Trim + length validation
  Given I enter "  " (spaces only) in first_name
  When I submit
  Then validation rejects it the same as empty

Scenario: "Signed in as" reflects my auth email
  Given I signed in with alice@example.com
  Then the screen shows "Signed in as alice@example.com"
```

## Architecture references

- [`../../architecture/auth.md`](../../architecture/auth.md) § "Data model" — `profiles.first_name`, `profiles.last_name` columns.
- [ADR-0016 — Onboarding data model revision](../../architecture/adr/0016-onboarding-data-model-revision.md) — reason the schema uses `first_name`/`last_name` rather than a single `display_name`.
- [`../../screen-inventory.md`](../../screen-inventory.md) § 2.1.

## Implementation notes

- **Form:** `<form action={saveName}>` with two `<input>` fields; Server Action returns `{ errors? }` and on success calls `redirect('/onboarding/studio')`.
- **Validation with Zod:**
  ```ts
  const NameSchema = z.object({
    first_name: z.string().trim().min(2).max(40),
    last_name:  z.string().trim().min(2).max(40),
  })
  ```
- **Persistence:**
  ```ts
  await supabase.from('profiles')
    .update({ first_name, last_name, updated_at: new Date().toISOString() })
    .eq('id', user.id)
  ```
  RLS `profiles: self update` policy from TASK-AUTH-02 covers this.
- **"Signed in as" line** uses `user.email`; render as a small muted caption below the step title.
- **Accessibility:** each input has a `<label>`; errors use `aria-describedby`.

## Review notes

- **No client-side DB write.** The Server Action is the only place that mutates.
- **Zod schema reused server-side** for validation. Do not trust client-side validation alone.
- **Idempotent submit.** Double-posting should result in the same state, not an error.
- **Do not clear other `profiles` columns** (`market`, `onboarding_completed_at`). Use `UPDATE … SET` with only the two columns.
- **Error surface.** Errors render inline under the field, not as a toast. Screen readers announce via `role="alert"` on the error region.

## Test plan

- **Unit:** `NameSchema` validates trim, min, max, both-empty, one-empty.
- **Unit:** Server Action calls `.update()` with the exact column set `{first_name, last_name, updated_at}` and no others.
- **Manual:** submit valid values, verify row in DB; revisit page and confirm pre-fill.
- **Manual:** enter only whitespace, confirm inline error; no DB write.
- **E2E coverage** ships in [TASK-TEST-03](../testing/TASK-TEST-03-onboarding-e2e-suite.md).

## Open questions

- None.
