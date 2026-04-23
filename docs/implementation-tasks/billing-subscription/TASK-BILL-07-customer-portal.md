---
id: TASK-BILL-07
title: Customer portal Server Action + entry
group: billing-subscription
status: ready
estimate: 2
dependencies: [TASK-BILL-01]
related_screens: []
related_adrs: []
created: 2026-04-22
---

# TASK-BILL-07 — Customer portal

## Goal

Give Pro users a single "Manage billing" entry point that hands off to Stripe's hosted Customer Portal: cancel, update payment method, view invoice history. All mutations come back to us via the webhook handler (TASK-BILL-05) — no separate reconciliation.

## Scope

**In scope**
- Server Action `createPortalSession()` that creates a Stripe Billing Portal session and redirects the user to it.
- Minimal "Manage billing" entry — a form button rendered wherever the account menu lives (or a stub page at `/billing` linking to the same action). Match whatever layout exists; don't invent a settings surface.
- `return_url` configured to `<APP_URL>/billing`.
- Non-Pro users see an "Upgrade to Pro" CTA instead of a portal link.

**Out of scope**
- Full account-settings UI — that's the future account-settings group. This task contributes only the "Manage billing" entry.
- Plan switching inside the portal — explicitly disabled in TASK-BILL-01 dashboard config.
- Email receipts — handled by Stripe.

## Acceptance criteria

```gherkin
Scenario: Pro user opens the portal
  Given subscriptions.status = 'active' for the current user
  When they click "Manage billing"
  Then createPortalSession is invoked
  And the browser is redirected to a billing.stripe.com/p/session/... URL
  And after returning the user lands back on /billing

Scenario: Free user sees upgrade CTA
  Given the current user has no subscriptions row (or status != 'active')
  When they navigate to /billing
  Then no portal link is shown
  And an "Upgrade to Pro" CTA is present linking to /onboarding/plan (or an in-app upgrade flow)

Scenario: Missing stripe_customer_id
  Given the user has a subscriptions row but stripe_customer_id is NULL (unexpected)
  When createPortalSession is called
  Then it throws a typed "no_customer" error
  And the UI surfaces "We couldn't open billing — contact support"

Scenario: Cancel from portal flows through webhook
  Given a user cancels via the portal
  When customer.subscription.updated (or .deleted) arrives
  Then TASK-BILL-05 updates subscriptions.status accordingly
  And the user is redirected back to /billing
  And the /billing page reflects the new state on next render
```

## Architecture references

- [`../../architecture/billing.md`](../../architecture/billing.md) § "Customer portal" — Server Action shape is quoted there.

## Implementation notes

- **Server Action:**
  ```ts
  'use server'
  export async function createPortalSession() {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('unauthenticated')
    const { data: sub } = await supabase
      .from('subscriptions').select('stripe_customer_id')
      .eq('user_id', user.id).single()
    if (!sub?.stripe_customer_id) throw new Error('no_customer')
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    })
    redirect(session.url!)
  }
  ```
- **`/billing` page** — small RSC that reads the subscription and renders either the "Manage billing" form or the upgrade CTA. Reuse `plans.ts` for display strings.
- **No service-role here.** The user's own client reading `subscriptions` is sufficient (RLS `self read` policy from TASK-AUTH-02).
- **Error copy.** `no_customer` is a developer-error path; it shouldn't happen in normal flow. Keep it short and route users to support.

## Review notes

- **Portal config is not app code.** If the portal surfaces plan-switching or features we don't support, the fix is in the Stripe dashboard (TASK-BILL-01), not here.
- **`return_url` uses `NEXT_PUBLIC_APP_URL`** — confirm this env is set in every environment (preview URLs should use their own).
- **Don't log the portal session URL** — it's a short-lived capability token.
- **Race vs webhook.** Users returning from the portal expect updated state. If the webhook hasn't landed, `/billing` may briefly show stale state. Acceptable for MVP; a future polish is to poll like TASK-BILL-06 does.
- **Single-sub assumption.** `.single()` on `subscriptions` assumes UNIQUE(user_id) from TASK-BILL-05. If that isn't merged yet, use `.maybeSingle()` and pick the most recent; add a reviewer note.

## Test plan

- **Unit:** `createPortalSession` — auth-check, customer-ID lookup, error types.
- **Integration:** seed an active subscription with `stripe_customer_id`; invoke the action; assert a real `billing_portal.sessions.create` call.
- **Manual:** full round-trip — click Manage billing → land on Stripe portal → cancel → webhook fires → `/billing` shows canceled state.
- **Manual:** as a Free user, confirm the Upgrade CTA path.
- **E2E coverage** ships in [TASK-TEST-04](../testing/TASK-TEST-04-billing-e2e-suite.md).

## Open questions

- None.
