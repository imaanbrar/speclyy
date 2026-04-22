# Billing

End-to-end architecture for Stripe billing: subscription model, checkout, webhooks, trial/lapse states, and failure handling. This is the authoritative doc for the billing subsystem — other docs reference here for anything beyond column-level detail.

---

## Overview

```mermaid
flowchart TD
  subgraph Designer
    CTA["Upgrade CTA / paywall hit"]
    Portal["Customer portal\n(cancel, update card)"]
  end

  subgraph Next.js["Next.js (Vercel)"]
    SA["Server Action\ncreateCheckoutSession"]
    PP["Server Action\ncreatePortalSession"]
    WH["Route Handler\nPOST /api/webhooks/stripe"]
    MW["middleware.ts\nsubscription gate"]
  end

  subgraph Stripe
    CO["Stripe Checkout"]
    CP["Customer Portal"]
    EV["Webhook events"]
  end

  DB[("Supabase DB\npublic.subscriptions")]

  CTA --> SA --> CO --> WH
  Portal --> PP --> CP --> EV
  EV --> WH
  WH -->|"Drizzle / service-role"| DB
  DB --> MW
```

---

## Subscription model

### Plans

| Plan | Stripe Price ID | Price | Features |
|---|---|---|---|
| Free | — (no Stripe record) | $0 | Full app access; PDF export gated (blurred preview) |
| Pro Monthly | `price_xxx_monthly` | $37/month | Full access including PDF + shareable link export |
| Pro Annual | `price_xxx_annual` | $29/month billed annually ($348/yr — 30% off) | Full access including PDF + shareable link export |

> Price IDs are stored in env vars (`STRIPE_PRICE_ID_PRO_MONTHLY`, `STRIPE_PRICE_ID_PRO_ANNUAL`), not hardcoded. The interval selection is passed from the client to `createCheckoutSession` and resolved server-side.

### Subscription states

Free users have no row in `subscriptions`. Pro users have a Stripe-backed row.

| Stripe status | `subscriptions.status` | PDF export |
|---|---|---|
| *(no row)* | — | Blocked — blurred preview shown |
| `active` | `active` | Allowed |
| `past_due` | `past_due` | Blocked — upgrade prompt shown |
| `canceled` | `canceled` | Blocked — upgrade prompt shown |
| `incomplete` | `incomplete` | Blocked (payment not confirmed) |
| `incomplete_expired` | `incomplete_expired` | Blocked |

The app-wide middleware gate is removed. Access control lives at the export action: if the user has no active subscription, the PDF render returns a blurred preview and an upgrade CTA instead of a download.

---

## Checkout flow

Rendered inline using **Stripe Elements** — no redirect to Stripe's domain. See [ADR-0018](adr/0018-payment-surface.md) for rationale.

### Entry points

- **Onboarding step 4 (Plan)** — selecting Pro → `/onboarding/checkout`
- **PDF export paywall** — upgrade CTA on blurred preview
- **Upgrade CTA** — account settings

### Server: create subscription + return `client_secret`

```ts
// app/(billing)/billing/actions.ts
'use server'
export async function createProSubscription(interval: 'monthly' | 'annual') {
  const supabase = createServerClient(...)
  const { data: { user } } = await supabase.auth.getUser()

  // Reuse or create Stripe customer
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const customerId = existing?.stripe_customer_id
    ?? (await stripe.customers.create({
          email: user.email!,
          metadata: { userId: user.id },
        })).id

  const priceId = interval === 'annual'
    ? process.env.STRIPE_PRICE_ID_PRO_ANNUAL
    : process.env.STRIPE_PRICE_ID_PRO_MONTHLY

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
    metadata: { userId: user.id },
  })

  const clientSecret = (subscription.latest_invoice as Stripe.Invoice)
    .payment_intent as Stripe.PaymentIntent
  return { clientSecret: clientSecret.client_secret!, subscriptionId: subscription.id }
}
```

### Client: mount PaymentElement + confirm

```tsx
// app/(billing)/checkout/CheckoutForm.tsx
'use client'
const stripe = useStripe()
const elements = useElements()

async function onSubmit() {
  const { error } = await stripe!.confirmPayment({
    elements: elements!,
    confirmParams: { return_url: `${origin}/billing/success` },
  })
  // error.message rendered inline; success path handled by webhook + return_url
}
```

### Success / cancel return

- `/billing/success` — renders the Pro Success screen. Confirms `subscriptions.status = 'active'` before showing; if the webhook is still in flight (rare, <2s), shows a "finalizing…" state and polls.
- User cancel (closes tab / back) — the `incomplete` subscription remains in Stripe and expires automatically via Stripe's `incomplete_expired` after 23h. No cleanup needed.

No business logic on the return URL — all state changes happen via webhook.

---

## Customer portal

```ts
export async function createPortalSession() {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
  })

  redirect(session.url!)
}
```

Users can: cancel subscription, update payment method, view invoice history. Plan switching is disabled until multi-plan is supported.

All actions taken in the portal fire webhook events (`customer.subscription.updated`, `customer.subscription.deleted`) which reconcile the DB — no separate reconciliation needed.

---

## Webhook handling

### Endpoint

`POST /api/webhooks/stripe` — verified via `stripe.webhooks.constructEvent` before any processing.

```ts
// app/api/webhooks/stripe/route.ts
export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  await processEvent(event)  // idempotent
  return new Response('ok')
}
```

### Event taxonomy

| Event | Action |
|---|---|
| `customer.subscription.created` | Upsert subscription row with initial `status` (usually `incomplete`) |
| `customer.subscription.updated` | Update `status`, `current_period_end` |
| `customer.subscription.deleted` | Set `status = canceled` |
| `invoice.paid` / `invoice.payment_succeeded` | Set `status = active`, update `current_period_end` |
| `invoice.payment_failed` | Set `status = past_due` |
| `payment_intent.succeeded` | Informational; reconcile only if subscription.updated hasn't arrived |

`checkout.session.completed` is no longer used — we moved from hosted Checkout to embedded Elements ([ADR-0018](adr/0018-payment-surface.md)). `trial_ends_at` removed — free plan is indefinite, no trial.

### Idempotency

Each handler uses `stripe_event_id` (the Stripe event's `id` field) to dedup. The `processed_webhook_events` table stores seen event IDs:

```sql
CREATE TABLE public.processed_webhook_events (
  stripe_event_id text PRIMARY KEY,
  processed_at    timestamptz NOT NULL DEFAULT now()
);
```

On each incoming event: `INSERT ... ON CONFLICT DO NOTHING` returns `0 rows affected` → skip. This makes every handler safe to replay.

### Out-of-order events

Stripe does not guarantee delivery order. All handlers are idempotent and use `updated_at`-guarded upserts:

```ts
await db
  .insert(subscriptions)
  .values({ userId, status, currentPeriodEnd, ... })
  .onConflictDoUpdate({
    target: subscriptions.userId,
    set: { status, currentPeriodEnd, updatedAt: new Date() },
    where: sql`subscriptions.updated_at < ${new Date()}`,
  })
```

A `past_due` event arriving after `active` (due to retry) will not overwrite the newer `active` state.

### Stripe's own retries

Stripe retries failed webhook deliveries (non-2xx response) with exponential backoff over 3 days. Idempotency dedup ensures replays are safe.

---

## Free vs Pro gating

### Gate location

The gate is **not** in middleware. It lives inside the PDF export server action:

```ts
// app/(export)/export/actions.ts
export async function exportSpecPDF(projectId: string) {
  const supabase = createServerClient(...)
  const { data: { user } } = await supabase.auth.getUser()

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle()  // free users have no row

  const isPro = sub?.status === 'active'
  if (!isPro) {
    return { gated: true }  // client renders blurred preview + upgrade CTA
  }

  // ... generate and return PDF
}
```

### Blurred preview

When `gated: true` is returned, the client renders the PDF preview with a CSS blur filter and overlays an upgrade CTA. The designer sees the layout of their spec — enough to know the output is valuable — but cannot download it.

### What gets locked

Only PDF export and shareable link export are gated. All other features (projects, specs, product library, URL extraction) remain fully accessible on the free plan indefinitely. Project data is never deleted.

### Lapsed Pro (payment failure)

If a Pro subscription lapses (`past_due`, `canceled`), the user reverts to free plan behaviour — PDF export is gated again. Stripe handles dunning (retry emails) independently.

---

## Promo codes

Promo codes use Stripe Promotion Codes (not raw coupons). Codes are created in the Stripe dashboard and attached to a coupon (e.g. 30% off first 3 months).

`allow_promotion_codes: true` on the Checkout session exposes a promo code field to the user. Validation and application are handled by Stripe — no custom code needed.

`promo_code_id` on the `subscriptions` row is reserved for future internal tracking (not yet populated).

---

## Failure handling

### Webhook processing failures

If the handler throws, the endpoint returns 5xx → Stripe retries. For errors that are not transient (e.g. bad data), the handler logs to Axiom with the raw event payload and returns 200 to prevent Stripe retry storms, then alerts via Axiom monitor.

### Stripe API outages

Checkout and portal session creation are user-initiated. If Stripe is down, the Server Action throws and the UI shows a generic error. No queuing — the user retries manually.

### Reconciliation

A weekly Inngest cron job cross-checks `subscriptions` rows against Stripe's API for accounts with recent activity. If drift is detected (e.g. a missed webhook), it corrects the DB and logs the discrepancy to Axiom.

---

## Observability

Key metrics tracked in Axiom:

| Metric | Alert threshold |
|---|---|
| Webhook processing lag | > 30s p95 |
| Failed payment rate | > 5% of invoices in 24h |
| Webhook 5xx rate | any in 1h |
| Trial-to-paid conversion | dashboard only |

See [operations.md](operations.md) for the full observability setup.

---

## Open questions

- **Stripe Tax** — not yet configured. Will need to enable before expanding to US states with SaaS tax requirements.
- **Plan switching (monthly ↔ annual)** — post-MVP. At MVP, designers pick an interval at checkout; changing interval requires canceling and re-subscribing via the customer portal.
- **Additional gated features** — shareable link export is gated at the action level, same pattern as PDF export.
- **Team / seat billing** — not in scope for MVP.

---

## References

- [auth.md](auth.md) — subscription gate in middleware
- [database.md](database.md) — `subscriptions` schema
- [security.md](security.md) — webhook signature verification, service-role key handling
- [operations.md](operations.md) — webhook lag alerts, billing dashboards
