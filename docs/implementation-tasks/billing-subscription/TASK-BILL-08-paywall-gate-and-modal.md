---
id: TASK-BILL-08
title: Export paywall — isPro helper + blurred preview modal
group: billing-subscription
status: ready
estimate: 3
dependencies: [TASK-BILL-05]
related_screens: ["7.X Export Paywall Modal"]
related_adrs: []
created: 2026-04-22
---

# TASK-BILL-08 — Paywall gate + modal

## Goal

Ship the two primitives the PDF-export group (and any future Pro-gated surface) needs to enforce the Free vs Pro boundary: a server-side `isPro(userId)` helper and a client-side blurred-preview paywall modal that includes a Monthly / Annual toggle and an "Upgrade and export" CTA that routes into the existing checkout flow. The *actual* export action lives in the PDF group; this task provides the reusable gate.

## Scope

**In scope**
- `apps/web/src/lib/billing/access.ts` exporting `isPro(userId: string): Promise<boolean>` — queries `subscriptions.status` via the user's client (RLS `self read`).
- `<ExportPaywallModal>` — Client Component rendering:
  - Blurred-preview image (provided via prop — export group renders the preview; we blur + overlay here).
  - Plan toggle (Monthly / Annual).
  - "Upgrade and export" primary CTA — calls `createProSubscription(interval)` and hands off to `/onboarding/checkout`.
  - Dismiss / "Not now" secondary.
  - **No "Export blurred PDF"** — explicitly removed per [`../onboarding/_source-plan.md`](../onboarding/_source-plan.md) § "Tasks · Billing · Export paywall modal".
- Thin `GET /api/billing/is-pro` endpoint wrapping `isPro()` so client components can refresh state after a webhook lands (optional but useful in conjunction with TASK-BILL-06's polling).

**Out of scope**
- The PDF export action (`exportSpecPDF`) — lives in the PDF group; it *consumes* `isPro()`.
- Shareable-link export gating — same pattern, follows later.
- Any middleware-level subscription gate — not introduced; see [`../../architecture/billing.md`](../../architecture/billing.md) § "Gate location".

## Acceptance criteria

```gherkin
Scenario: isPro for active user
  Given subscriptions.status = 'active' for user U
  When isPro(U) is called
  Then it returns true

Scenario: isPro for past_due / canceled / missing
  Given subscriptions.status in ('past_due','canceled','incomplete','incomplete_expired') OR no row
  When isPro is called
  Then it returns false

Scenario: Paywall modal renders
  Given a Free user clicks "Export PDF" on a project
  And the export action returns { gated: true, previewUrl }
  When the modal mounts
  Then the blurred preview and the Monthly/Annual toggle are visible
  And the primary CTA reads "Upgrade and export"
  And there is no "Export blurred PDF" option

Scenario: Upgrade from modal
  Given the modal is open with interval = 'annual'
  When I click "Upgrade and export"
  Then createProSubscription('annual') is called
  And I am navigated to /onboarding/checkout (TASK-BILL-04)

Scenario: Dismiss returns to project
  When I click "Not now"
  Then the modal closes
  And I remain on the current project page

Scenario: Pro user hitting the helper
  Given isPro returned true in the server action
  Then the paywall modal is never shown
  And the download proceeds (PDF group's responsibility)
```

## Architecture references

- [`../../architecture/billing.md`](../../architecture/billing.md) § "Free vs Pro gating" — action-level gate + blurred preview.
- [`../onboarding/_source-plan.md`](../onboarding/_source-plan.md) § "Tasks · Billing · Export paywall modal" — **no download on Free** (design overridden).

## Implementation notes

- **`isPro` shape:**
  ```ts
  export async function isPro(userId?: string): Promise<boolean> {
    const supabase = createServerClient()
    const { data } = await supabase.from('subscriptions')
      .select('status').eq('user_id', userId ?? (await supabase.auth.getUser()).data.user!.id)
      .maybeSingle()
    return data?.status === 'active'
  }
  ```
  Keep it in `lib/billing/access.ts` so any future consumer has a single import path.
- **Modal contract:**
  ```ts
  type ExportPaywallProps = {
    previewUrl: string // blurred-preview image/URL from the export action
    projectId: string  // passed through so the returning checkout can resume export
  }
  ```
  After a successful upgrade the user lands on `/billing/success`; they navigate back to the project and re-click Export to actually download. Keep it simple — no cross-session "resume export" flow for MVP.
- **Blur rendering** — use `filter: blur(12px)` on a preview `<img>`; apply a subtle dark overlay + the upgrade card on top.
- **Interval toggle** — a segmented control; pre-selects annual (matches the billing narrative that annual is preferred).
- **No DB writes** in the modal — `createProSubscription` is the only mutation, and it's a Server Action.

## Review notes

- **Gate is authoritative at the action, not at the UI.** The modal prevents a user seeing a download button they can't use, but the PDF action itself must still check `isPro`. Reviewer: flag any PDF-group PR that skips the server-side gate.
- **`past_due` is NOT Pro.** Double-check the enum list in `isPro` — forgetting it lets lapsed users keep exporting.
- **No "Export blurred PDF" button.** Per the source plan, Free users get preview only. Don't add a download path that emits a watermarked PDF.
- **Preview URL handling.** The blurred image should not leak the unblurred PDF — render a raster preview on the server, don't ship the PDF bytes to the client and blur in CSS.
- **Accessibility.** Modal is focus-trapped; Escape dismisses; the blur has `aria-hidden="true"` and the CTA is the first focusable element.
- **Modal is Client, helper is Server.** Keep the import boundaries clean — no client file imports `access.ts`.

## Test plan

- **Unit:** `isPro` — table test over the six possible `subscriptions.status` values + no-row case.
- **Unit:** modal renders with the correct CTA label; dismiss closes.
- **Integration:** from a Free user's perspective, calling a dummy gated action returns `{ gated: true }` and the modal mounts.
- **Manual:** as a Pro user (seeded), confirm no modal; as Free, confirm modal with correct copy.
- **Manual:** click Upgrade → land on `/onboarding/checkout` with a valid clientSecret (via TASK-BILL-04 handoff).
- **E2E coverage** (full Free→gated→upgrade→active→export) ships in [TASK-TEST-04](../testing/TASK-TEST-04-billing-e2e-suite.md) plus the PDF group's testing task once it exists.

## Open questions

- None. No auto-export on return from checkout — the user navigates back to the project and clicks Export again (decided). Avoids resumable-intent complexity for marginal UX gain.
