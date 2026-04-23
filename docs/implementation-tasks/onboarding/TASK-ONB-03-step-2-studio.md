---
id: TASK-ONB-03
title: Step 2 · Studio — organization + size (with Skip)
group: onboarding
status: ready
estimate: 3
dependencies: [TASK-ONB-02]
related_screens: ["2.2 Onboarding · Studio"]
related_adrs: [ADR-0016, ADR-0019]
created: 2026-04-22
---

# TASK-ONB-03 — Step 2 · Studio

## Goal

Collect studio name + size, or let the user skip. Either way, create an `organizations` row and a `role='owner'` `organization_members` row. This is the step that satisfies the invariant "every onboarded profile has exactly one organization_members row."

## Scope

**In scope**
- Route: `apps/web/src/app/(onboarding)/onboarding/studio/page.tsx`.
- Form: `studio_name` (required) + `size` radio group (`solo | 2_5 | 6_10 | 11_plus`, required).
- Two Server Actions:
  - `saveStudio({ name, size })` — creates `organizations` row with `type='studio'` + linked `organization_members`.
  - `skipStudio()` — creates `organizations` row with `type='individual'`, `name = "{first_name} {last_name}"`, `size = NULL`; links via `organization_members`.
- Footer: **Back** (to `/onboarding/name`) + **Skip** (right side) + **Continue** (primary).
- Advance to `/onboarding/market` on either path.

**Out of scope**
- Multi-org accounts / inviting teammates — post-MVP.
- Editing studio from settings — account-settings group.
- Changing `type` from `individual` → `studio` later — post-MVP (ADR-0019 notes this as supported but not in MVP scope).

## Acceptance criteria

```gherkin
Scenario: Save studio
  Given I enter "Canvas Studio" and select "2–5"
  When I submit
  Then an organizations row exists with name='Canvas Studio', type='studio', size='2_5'
  And an organization_members row exists with user_id = me, role='owner'
  And I am redirected to /onboarding/market

Scenario: Skip
  Given profiles.first_name = 'Alice', last_name = 'Chen'
  When I click Skip
  Then an organizations row exists with name='Alice Chen', type='individual', size=NULL
  And an organization_members row links me with role='owner'
  And I am redirected to /onboarding/market

Scenario: Revisit after save
  Given I already saved a studio in this onboarding session
  When I navigate back to /onboarding/studio
  Then the inputs are pre-filled from my organization
  And submitting again UPDATES the existing row (does not create a second one)

Scenario: Revisit after skip
  Given I skipped and now return to /onboarding/studio
  When I fill in a real studio name/size and Continue
  Then my existing individual-type organization is converted:
    name → entered value, type → 'studio', size → entered value
  (No second organizations row is created.)

Scenario: Validation
  Given empty studio name or no size selected
  When I click Continue (not Skip)
  Then the Server Action rejects with field errors
  And no DB write occurs

Scenario: Duplicate names are allowed
  Given another user's organization is also named "Canvas Studio"
  When I submit
  Then the row is created successfully (no UNIQUE on name per TASK-AUTH-02)
```

## Architecture references

- [`../../architecture/auth.md`](../../architecture/auth.md) § "Data model" — `organizations`, `organization_members`, invariant note.
- [ADR-0019 — Multi-app architecture](../../architecture/adr/0019-multi-app-architecture.md) — `type` discriminator + rationale for creating the org in the Server Action (not the trigger).
- [ADR-0016 — Onboarding data model revision](../../architecture/adr/0016-onboarding-data-model-revision.md) — studio-size values + "no dedupe" decision.
- [`../../implementation-tasks/onboarding/_source-plan.md`](_source-plan.md) § "Decisions (confirmed)" items 1, 3, 7, 8 — authoritative for size values, Skip behavior, and duplicate-name allowance.

## Implementation notes

- **Size values:** exactly `'solo' | '2_5' | '6_10' | '11_plus'` — matches the CHECK in TASK-AUTH-02.
- **Persistence strategy:** look up an existing `organization_members` row for the user. If present → UPDATE the linked `organizations` row. If absent → INSERT org + INSERT member, ideally in one transaction (RPC or `.rpc()` wrapper). Using two separate inserts is acceptable if wrapped in a Supabase transaction via `@supabase/supabase-js` RPC.
- **Write path decision (RLS).** Two options:
  1. Add a narrow `INSERT`/`UPDATE` policy on `organizations` + `organization_members` allowing a user to create their own first org. **Preferred** — keeps the service-role key out of request-path code.
  2. Run the Server Action with the service-role client. Faster to ship but widens the service-role surface area.

  **Option 1 is decided.** The required INSERT policies (`organizations` `WITH CHECK (auth.uid() IS NOT NULL)` and `organization_members` `WITH CHECK (user_id = auth.uid())`) are already included in the initial schema in [TASK-AUTH-02](../auth/TASK-AUTH-02-db-migration-auth-tables.md) — this task just consumes them.
- **Skip helper:**
  ```ts
  export async function skipStudio() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase.from('profiles')
      .select('first_name,last_name').eq('id', user.id).single()
    const displayName = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'My workspace'
    await upsertOrg({ name: displayName, type: 'individual', size: null })
    redirect('/onboarding/market')
  }
  ```
- **`saveStudio` writes `type: 'studio'`** regardless of whether the user previously skipped — the step's intent is to declare a studio.
- **"Skip" is a form button** with `formAction={skipStudio}`; same `<form>` as Continue to keep the no-JS story working.

## Review notes

- **Invariant audit.** After either Server Action completes, exactly one `organization_members` row exists for the user. Reviewers: confirm this in the unit / integration test.
- **RLS policy scope.** If option 1 is taken, the INSERT policy must check `auth.uid() = user_id` for `organization_members` and gate `organizations` INSERT to authenticated users. Don't over-permit.
- **No duplicate orgs on revisit.** The UPDATE-on-revisit path must be exercised by a test; otherwise users who back-button land with two orgs linked.
- **Fallback name.** If somehow first/last are empty at Skip time (user raced through), fall back to `'My workspace'` — never insert `' '`.
- **Transactionality.** If the org INSERT succeeds but the member INSERT fails, the user ends in a broken state. Wrap in a Postgres function or use service-role with a single RPC if needed.
- **`type` values are exactly the CHECK list** — `'individual' | 'studio'` only during MVP. Don't introduce `'firm' | 'team'` here.

## Test plan

- **Unit:** validation schema (name required, size in allowed set).
- **Integration:** call `saveStudio` with a seeded user → assert one `organizations` + one `organization_members` row. Call again with new values → assert same row IDs, updated fields.
- **Integration:** call `skipStudio` → assert `type='individual'`, `name` matches `"{first} {last}"`, `size IS NULL`.
- **Integration:** skip-then-save path — final state has `type='studio'` with one row pair.
- **Integration (RLS):** as user U1 attempt to INSERT an `organization_members` row linking U2 — must be rejected.
- **Manual:** fresh user walk-through both Save and Skip paths.
- **E2E coverage** ships in [TASK-TEST-03](../testing/TASK-TEST-03-onboarding-e2e-suite.md).

## Open questions

- None. No inline Skip tooltip — the link's copy is self-explanatory and the Settings entry is implicit.
