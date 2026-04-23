---
id: TASK-BILL-06
title: Pro Success screen + onboarding completion
group: billing-subscription
status: ready
estimate: 2
dependencies: [TASK-BILL-04, TASK-BILL-05]
related_screens: ["2.4b Onboarding · Pro Success"]
related_adrs: []
created: 2026-04-22
---

# TASK-BILL-06 — Pro Success screen

## Goal

Post-checkout landing page for Pro users. Confirms the subscription is `active` before celebrating; if the webhook hasn't landed yet (rare, <2s), renders a "finalizing…" poll state. On confirmation, sets `profiles.onboarding_completed_at` (for users arriving from onboarding Step 4) and routes the user into the app.

## Scope

**In scope**
- Route: `apps/web/src/app/(billing)/billing/success/page.tsx`.
- Server-side check for `subscriptions.status = 'active'` for the current user.
- If active → render receipt block (plan name, interval, renewal date, amount) + primary CTA "Open your workspace" → `/projects`; also set `onboarding_completed_at` if still null.
- If not yet active → render "Finalizing your subscription…" state with client-side polling (1s interval, 15s cap).
- Timeout behavior: after 15s without an `active` state, show a non-scary message ("Still processing — we'll email you when it lands") with a CTA back to `/projects`. Onboarding can still be completed on Free-equivalent state if needed — but for a `Pro` flow we keep onboarding NOT completed and let the webhook + the user's next visit finalize it.

**Out of scope**
- Receipt PDF — Stripe provides one via email.
- Welcome email — post-MVP.
- Free Welcome screen — TASK-ONB-06.

## Acceptance criteria

```gherkin
Scenario: Active on arrival
  Given the webhook already processed customer.subscription.created + invoice.payment_succeeded
  When I land on /billing/success from Stripe's return_url
  Then the page renders the receipt block
  And profiles.onboarding_completed_at is set (if previously NULL)
  And the primary CTA "Open your workspace" routes to /projects

Scenario: Webhook in flight
  Given the user just confirmed payment and subscriptions.status is not yet 'active'
  When the page loads
  Then a "Finalizing your subscription…" spinner is shown
  And the client polls GET /api/billing/status every 1s
  And upon receiving { status: 'active' } the page re-renders the success state

Scenario: Polling timeout
  Given 15 seconds elapse without status = 'active'
  When the timeout hits
  Then a soft "Still processing — check back soon" message is shown
  And onboarding_completed_at is NOT set (user remains mid-onboarding)
  And a CTA "Back to plan" returns to /onboarding/plan

Scenario: Unauthenticated access
  Given no session
  When /billing/success is requested
  Then middleware redirects to /sign-in

Scenario: User without any subscription
  Given subscriptions table has no row for this user
  When they force-navigate to /billing/success
  Then they are redirected to /onboarding/plan (or /projects if onboarded)
```

## Architecture references

- [`../../architecture/billing.md`](../../architecture/billing.md) § "Success / cancel return" — behavior spec.
- [`../onboarding/_source-plan.md`](../onboarding/_source-plan.md) § "Tasks · Billing · Pro Success screen".

## Implementation notes

- **Status endpoint:** `apps/web/src/app/api/billing/status/route.ts` — GET returning `{ status: Subscriptions['status'] | null }`. Used by the client poller. Must use a Supabase client authenticated as the user (NOT service-role).
- **Onboarding completion.** When server-side status is `active` and `profiles.onboarding_completed_at` is `NULL`, update it in the same render path. Guard the UPDATE with `WHERE onboarding_completed_at IS NULL` to keep it idempotent.
- **Receipt block values** — read from the Stripe `Subscription` + `Invoice` once (server side) for correctness, or from our own `subscriptions.current_period_end` + the `plans.ts` config. Prefer our row + config to avoid another Stripe round-trip.
- **Polling hygiene.** Use an `AbortController` tied to unmount; stop at 15s. Don't poll forever.

## Review notes

- **Source of truth.** `subscriptions.status = 'active'` is the only signal we trust — not Stripe's return URL's query params. Reviewer: confirm no reliance on Stripe-injected query args for business decisions.
- **Onboarding completion guard.** The `WHERE onboarding_completed_at IS NULL` clause must be present; missing it can stomp a previously-recorded timestamp on repeat visits.
- **Polling cap.** 15s and no indefinite retries. Long tails get a friendly fallback message.
- **Do not mark onboarding complete on timeout.** The user paid but their access is driven by the `subscriptions` row — which is real; their onboarding state can catch up on next visit.
- **No cardholder data in logs.** `Invoice`/`Subscription` objects may contain identifying info. Log IDs, not objects.

## Test plan

- **Unit:** "already active" path updates `onboarding_completed_at` once; second render leaves it alone.
- **Unit:** polling state machine — transitions `idle → polling → success | timeout`.
- **Integration:** seed an `active` subscription; render the page server-side; assert receipt props + completion.
- **Integration:** seed no subscription; simulate webhook delay by running the handler 3s after page load; assert the poller sees `active` and transitions.
- **Manual:** complete a real test-card purchase via TASK-BILL-04; land here; confirm success render.
- **Manual:** kill the webhook locally (stop `stripe listen`) mid-flow; observe the 15s timeout fallback.
- **E2E coverage** ships in [TASK-TEST-04](../testing/TASK-TEST-04-billing-e2e-suite.md).

## Open questions

- None.
