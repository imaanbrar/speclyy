---
id: TASK-ONB-01
title: Onboarding layout, progress shell, defensive profile upsert
group: onboarding
status: ready
estimate: 2
dependencies: [TASK-AUTH-04]
related_screens: ["2.1 Onboarding · Name", "2.2 Onboarding · Studio", "2.3 Onboarding · Market", "2.4 Onboarding · Plan"]
related_adrs: [ADR-0019]
created: 2026-04-22
---

# TASK-ONB-01 — Onboarding shell

## Goal

Stand up the shared layout for the four onboarding steps: logo header, footer, progress component ("Step X of 4"), and a defensive `profiles` upsert that guarantees the row exists before any step's Server Action runs. This is the scaffolding every subsequent onboarding task plugs into.

## Scope

**In scope**
- Route group `apps/web/src/app/(onboarding)/` with `layout.tsx`.
- `<OnboardingProgress step={1|2|3|4} />` — 4-dot indicator + text label "Step X of 4".
- Footer with Privacy / Terms / Sign out links.
- A server-side `ensureProfile()` helper invoked in the layout that upserts `profiles` on `id = auth.uid()` (no-op if the row exists). Defensive only — the real source is the `handle_new_user` trigger.
- Redirect-if-onboarded guard (belt-and-braces on top of middleware): layout checks `is_onboarded` and redirects to `/projects`.
- A shared `_components/` folder for step-local UI that later tasks extend.

**Out of scope**
- Actual step forms — TASK-ONB-02 … -05.
- Free Welcome / Pro Success screens — TASK-ONB-06 / TASK-BILL-06.
- Account menu — belongs to the (future) account-settings group; sign-out link here is a plain `<form action="/auth/sign-out" method="post">`.

## Acceptance criteria

```gherkin
Scenario: Progress label matches step
  Given I visit /onboarding/name
  Then the progress shows "Step 1 of 4"
  When I visit /onboarding/studio
  Then it shows "Step 2 of 4"

Scenario: Layout renders for any authenticated user
  Given I am authenticated and is_onboarded = false
  When I visit any /onboarding/* path
  Then the shell renders with logo, progress, and footer
  And no redirect occurs

Scenario: Onboarded user is bounced
  Given is_onboarded = true
  When I visit /onboarding/name directly
  Then I am redirected to /projects
  (Redundant with middleware; this is the belt-and-braces check.)

Scenario: Missing profile row is self-healing
  Given (edge case) the trigger did not fire and no profiles row exists
  When the layout loads
  Then ensureProfile() upserts the row
  And the step renders without error

Scenario: Sign out is reachable
  Given I am mid-onboarding
  When I click "Sign out" in the footer
  Then I end on /sign-in
```

## Architecture references

- [`../../architecture/auth.md`](../../architecture/auth.md) § "Data model" — the `profiles` row shape `ensureProfile` must match.
- [`../../implementation-tasks/onboarding/_source-plan.md`](_source-plan.md) § "Decisions (confirmed)" item 9 — progress label is "Step X of 4" on all four screens.
- [ADR-0019 — Multi-app architecture](../../architecture/adr/0019-multi-app-architecture.md) — UI uses "Studio"; keep "organization" out of user-facing strings.

## Implementation notes

- **Layout shape:**
  ```tsx
  // app/(onboarding)/layout.tsx
  export default async function Layout({ children }: { children: ReactNode }) {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/sign-in') // middleware covers this, but fail closed
    await ensureProfile(user.id)
    const { data: profile } = await supabase
      .from('profiles').select('is_onboarded').eq('id', user.id).single()
    if (profile?.is_onboarded) redirect('/projects')
    return <Shell>{children}</Shell>
  }
  ```
- **`ensureProfile(userId)`** — single `INSERT … ON CONFLICT (id) DO NOTHING`. Does not touch any other column.
- **Progress component** reads its `step` prop from each page (no route introspection). Keeps it a dumb, testable component.
- **Sign-out link** is the `<form>` from TASK-AUTH-08, not a button on a Client Component.

## Review notes

- **Don't duplicate middleware logic.** The layout's onboarded-redirect is defensive, not primary. If a reviewer proposes moving the gate logic here, point back to TASK-AUTH-04.
- **`ensureProfile` must be idempotent and column-scoped.** Never write `first_name = ''` or similar defaults — later steps would see an empty-string instead of `NULL`.
- **No client-side auth reads.** The layout is an RSC; all Supabase calls server-side.
- **Footer sign-out must be a POST**, not a GET link, to match TASK-AUTH-08's 405 contract.
- **Keep the component tree small.** Shell is a header + `<main>{children}</main>` + footer. Don't prematurely extract a state provider.

## Test plan

- **Unit:** `<OnboardingProgress step={n} />` renders the right label and highlights the correct dot for each `n ∈ {1,2,3,4}`.
- **Unit:** `ensureProfile` calls `.upsert(…, { onConflict: 'id', ignoreDuplicates: true })` (or equivalent) exactly once.
- **Manual:** visit each of `/onboarding/{name,studio,market,plan}` as a mid-onboarding user; confirm progress label and active dot.
- **Manual:** delete the profiles row for a test user; reload `/onboarding/name` and confirm self-heal + step renders.
- **Manual:** as an onboarded user, try `/onboarding/name` and confirm redirect to `/projects`.
- **E2E coverage** ships in [TASK-TEST-03](../testing/TASK-TEST-03-onboarding-e2e-suite.md).

## Open questions

- None.
