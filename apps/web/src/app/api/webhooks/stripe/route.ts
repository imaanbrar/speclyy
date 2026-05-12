import { stripe, type Stripe } from '@/lib/billing/stripe'
import {
  recordEventProcessed,
  setSubscriptionStatusIfNewer,
  upsertSubscriptionState,
  type SubscriptionStatus,
} from '@/lib/billing/subscription-writer'

/**
 * `POST /api/webhooks/stripe` — single source of truth for `subscriptions`
 * mutations.
 *
 * Lifecycle of an inbound event:
 *
 *   1. **Verify signature** with `STRIPE_WEBHOOK_SECRET`. Wrong / missing →
 *      400 immediately, no body read after this. Stripe will not retry 400s.
 *   2. **Dedup** by inserting `event.id` into `processed_webhook_events`. If
 *      the row already exists (PK conflict), return 200 — replay is a no-op.
 *   3. **Dispatch** to a per-event handler.
 *   4. **Return 200** for every handled, ignored, or "logically broken" case
 *      (missing metadata, unknown event type) so Stripe doesn't retry-storm.
 *      Only return 5xx for genuine infra failures (DB unreachable etc.) where
 *      a retry has a real chance of succeeding.
 *
 * The `runtime = 'nodejs'` directive is required: the Stripe SDK uses Node's
 * `crypto` for signature verification and is not edge-compatible.
 *
 * The raw body is required to validate the signature — do NOT call
 * `req.json()` before `constructEvent`. App Router's `req.text()` returns the
 * raw bytes Stripe signed.
 *
 * See:
 *   - docs/architecture/billing.md § "Webhook handling"
 *   - docs/implementation-tasks/billing-subscription/TASK-BILL-05-stripe-webhook-handler.md
 *   - docs/architecture/adr/0017-subscription-ownership.md — `metadata.userId`
 *   - docs/architecture/adr/0018-payment-surface.md — no `checkout.session.completed`
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

// ---------- helpers ----------

type LogOutcome =
  | 'processed'
  | 'dedup'
  | 'unhandled'
  | 'skipped'
  | 'invalid'
  | 'error'
  | 'warn'

function logEvent(outcome: LogOutcome, fields: Record<string, unknown>) {
  // Structured (single-line JSON) so Vercel + Axiom both parse it cleanly.
  // NEVER include the raw event body — payment intents may contain card-
  // adjacent fields and Stripe's redaction guarantees stop at the JSON edge.
  //
  // `warn` outcomes use console.warn so log-level filtering works; everything
  // else is informational.
  const line = JSON.stringify({ msg: 'stripe-webhook', outcome, ...fields })
  if (outcome === 'warn' || outcome === 'error') {
    console.warn(line)
  } else {
    console.log(line)
  }
}

/**
 * Map a `SubscriptionWriteResult` to a log outcome. `no_row_yet` is bumped to
 * `warn` because it represents a permanently-dropped event (see
 * `subscription-writer.ts` — Stripe won't retry once the dedup row is in).
 */
function outcomeFromWriteResult(result: { wrote: boolean; skipReason?: string }): LogOutcome {
  if (result.wrote) return 'processed'
  if (result.skipReason === 'no_row_yet') return 'warn'
  return 'skipped'
}

/**
 * Extract `metadata.userId` from a Stripe Subscription. The Server Action
 * (TASK-BILL-03) sets it on every subscription create; if it's missing,
 * either the subscription was created outside our app or someone broke the
 * action — both alert-worthy.
 */
function getUserId(metadata: Stripe.Metadata | null | undefined): string | null {
  const value = metadata?.userId
  return typeof value === 'string' && value.length > 0 ? value : null
}

function toStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
  // Stripe's `Subscription.Status` includes a few values we don't model
  // (`trialing`, `unpaid`, `paused`). Map to the closest known status — the
  // CHECK constraint on `subscriptions.status` only allows our five values.
  switch (stripeStatus) {
    case 'active':
    case 'past_due':
    case 'canceled':
    case 'incomplete':
    case 'incomplete_expired':
      return stripeStatus
    case 'trialing':
      // We don't run trials per mvp-decisions.md § 10. If one ever appears
      // (manual dashboard fiddling), treat as active so the user isn't
      // accidentally gated.
      return 'active'
    case 'unpaid':
      return 'past_due'
    case 'paused':
      return 'past_due'
    default:
      return 'incomplete'
  }
}

function periodEndDate(sub: Stripe.Subscription): Date | null {
  // Stripe field name varies by API version. 2026-04-22.dahlia moved the
  // period boundaries onto the line items but kept a subscription-level
  // compat shim. Read both with the subscription level winning when present
  // (cheaper, no array indexing); fall through to the line item if the shim
  // is gone in a future API version.
  //
  // Mirrored in `apps/web/src/app/(billing)/billing/success/page.tsx:resolvePeriodEndEpoch`.
  const subLevel = (sub as Stripe.Subscription & { current_period_end?: number })
    .current_period_end
  if (typeof subLevel === 'number') return new Date(subLevel * 1000)

  const item = sub.items?.data?.[0] as
    | (Stripe.SubscriptionItem & { current_period_end?: number })
    | undefined
  const itemLevel = item?.current_period_end
  if (typeof itemLevel === 'number') return new Date(itemLevel * 1000)

  return null
}

// ---------- per-event handlers ----------
// Each returns void; throw to escalate to a 5xx + Stripe retry. Logical
// failures (missing metadata) log + return cleanly so Stripe stops retrying.

async function onSubscriptionUpsert(event: Stripe.Event) {
  const sub = event.data.object as Stripe.Subscription
  const userId = getUserId(sub.metadata)
  if (!userId) {
    logEvent('error', {
      eventId: event.id,
      type: event.type,
      reason: 'missing_user_id_metadata',
      subscriptionId: sub.id,
    })
    return
  }

  const result = await upsertSubscriptionState({
    userId,
    status: toStatus(sub.status),
    currentPeriodEnd: periodEndDate(sub),
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripeSubscriptionId: sub.id,
    eventCreatedAt: new Date(event.created * 1000),
  })

  logEvent(outcomeFromWriteResult(result), {
    eventId: event.id,
    type: event.type,
    userId,
    subscriptionId: sub.id,
    status: sub.status,
    skipReason: result.skipReason,
  })
}

async function onSubscriptionCanceled(event: Stripe.Event) {
  const sub = event.data.object as Stripe.Subscription
  const userId = getUserId(sub.metadata)
  if (!userId) {
    logEvent('error', {
      eventId: event.id,
      type: event.type,
      reason: 'missing_user_id_metadata',
      subscriptionId: sub.id,
    })
    return
  }

  const result = await setSubscriptionStatusIfNewer({
    userId,
    status: 'canceled',
    eventCreatedAt: new Date(event.created * 1000),
  })

  logEvent(outcomeFromWriteResult(result), {
    eventId: event.id,
    type: event.type,
    userId,
    subscriptionId: sub.id,
    skipReason: result.skipReason,
  })
}

/**
 * Resolve the Stripe Subscription tied to an invoice. Invoices don't carry
 * our `metadata.userId` directly (we only set it on the subscription), so we
 * fetch the subscription to read its metadata.
 */
async function fetchSubscriptionForInvoice(
  invoice: Stripe.Invoice,
): Promise<Stripe.Subscription | null> {
  // Stripe surfaces the related subscription either as `invoice.subscription`
  // (legacy) or via `invoice.parent.subscription_details.subscription` (new
  // API versions). Fall through both; if neither, this isn't a subscription
  // invoice.
  const direct = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null })
    .subscription
  if (typeof direct === 'string') return stripe.subscriptions.retrieve(direct)
  if (direct && typeof direct === 'object') return direct

  const details = (invoice as Stripe.Invoice & {
    parent?: { subscription_details?: { subscription?: string } }
  }).parent?.subscription_details?.subscription
  if (typeof details === 'string') return stripe.subscriptions.retrieve(details)

  return null
}

async function onInvoicePaid(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice
  const sub = await fetchSubscriptionForInvoice(invoice)
  if (!sub) {
    logEvent('skipped', {
      eventId: event.id,
      type: event.type,
      reason: 'invoice_without_subscription',
      invoiceId: invoice.id,
    })
    return
  }

  const userId = getUserId(sub.metadata)
  if (!userId) {
    logEvent('error', {
      eventId: event.id,
      type: event.type,
      reason: 'missing_user_id_metadata',
      subscriptionId: sub.id,
    })
    return
  }

  // `invoice.paid` / `invoice.payment_succeeded` are the activation signal:
  // status flips to active and entitlements set. Use upsert (not status-only)
  // because if `customer.subscription.created` lost a race we still want the
  // row to exist after the payment lands.
  const result = await upsertSubscriptionState({
    userId,
    status: 'active',
    currentPeriodEnd: periodEndDate(sub),
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripeSubscriptionId: sub.id,
    eventCreatedAt: new Date(event.created * 1000),
  })

  logEvent(outcomeFromWriteResult(result), {
    eventId: event.id,
    type: event.type,
    userId,
    subscriptionId: sub.id,
    invoiceId: invoice.id,
    skipReason: result.skipReason,
  })
}

async function onInvoicePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice
  const sub = await fetchSubscriptionForInvoice(invoice)
  if (!sub) {
    logEvent('skipped', {
      eventId: event.id,
      type: event.type,
      reason: 'invoice_without_subscription',
      invoiceId: invoice.id,
    })
    return
  }

  const userId = getUserId(sub.metadata)
  if (!userId) {
    logEvent('error', {
      eventId: event.id,
      type: event.type,
      reason: 'missing_user_id_metadata',
      subscriptionId: sub.id,
    })
    return
  }

  const result = await setSubscriptionStatusIfNewer({
    userId,
    status: 'past_due',
    eventCreatedAt: new Date(event.created * 1000),
  })

  logEvent(outcomeFromWriteResult(result), {
    eventId: event.id,
    type: event.type,
    userId,
    subscriptionId: sub.id,
    invoiceId: invoice.id,
    skipReason: result.skipReason,
  })
}

async function onPaymentIntentSucceeded(event: Stripe.Event) {
  // Informational only — `invoice.payment_succeeded` is the canonical
  // activation signal. We log so reconciliation tooling has a breadcrumb;
  // no DB write.
  const pi = event.data.object as Stripe.PaymentIntent
  logEvent('unhandled', {
    eventId: event.id,
    type: event.type,
    paymentIntentId: pi.id,
    note: 'informational; activation handled by invoice.payment_succeeded',
  })
}

const handlers: Record<string, (event: Stripe.Event) => Promise<void>> = {
  'customer.subscription.created': onSubscriptionUpsert,
  'customer.subscription.updated': onSubscriptionUpsert,
  'customer.subscription.deleted': onSubscriptionCanceled,
  'invoice.paid': onInvoicePaid,
  'invoice.payment_succeeded': onInvoicePaid,
  'invoice.payment_failed': onInvoicePaymentFailed,
  'payment_intent.succeeded': onPaymentIntentSucceeded,
}

// ---------- route ----------

export async function POST(req: Request) {
  if (!WEBHOOK_SECRET) {
    // Bail loud — better a 500 here in dev than a silently-skipped event.
    logEvent('error', { reason: 'STRIPE_WEBHOOK_SECRET not configured' })
    return new Response('Server misconfigured', { status: 500 })
  }

  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    logEvent('invalid', { reason: 'missing_signature_header' })
    return new Response('Missing signature', { status: 400 })
  }

  // Raw body — required for signature verification. Do NOT replace with
  // req.json() or any parser that touches the bytes.
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET)
  } catch (cause) {
    logEvent('invalid', {
      reason: 'signature_verification_failed',
      error: cause instanceof Error ? cause.message : String(cause),
    })
    return new Response('Invalid signature', { status: 400 })
  }

  // Idempotency check + claim. Insert wins → first time seeing this event;
  // conflict → already processed, return 200 with no further work.
  let firstSeen: boolean
  try {
    firstSeen = await recordEventProcessed(event.id)
  } catch (cause) {
    // DB write failed for a non-conflict reason. Let Stripe retry.
    logEvent('error', {
      eventId: event.id,
      type: event.type,
      reason: 'dedup_insert_failed',
      error: cause instanceof Error ? cause.message : String(cause),
    })
    return new Response('Transient error', { status: 503 })
  }

  if (!firstSeen) {
    logEvent('dedup', { eventId: event.id, type: event.type })
    return new Response('ok')
  }

  const handler = handlers[event.type]
  if (!handler) {
    logEvent('unhandled', { eventId: event.id, type: event.type })
    return new Response('ok')
  }

  try {
    await handler(event)
    return new Response('ok')
  } catch (cause) {
    // Distinguish transient (let Stripe retry) from terminal (don't). For
    // MVP: any handler throw is treated as transient — the dedup row is
    // already inserted, so a successful retry will short-circuit at the
    // dedup check. That means a *terminal* failure here causes Stripe to
    // give up after its 3-day backoff window, which is the right behaviour:
    // if our handler can't recover, no number of retries helps.
    //
    // The dedup-row-survives-failure tradeoff: once recorded, an event can
    // never be replayed via Stripe retry. The reconciliation cron (post-
    // MVP) is the safety net for missed state.
    logEvent('error', {
      eventId: event.id,
      type: event.type,
      reason: 'handler_threw',
      error: cause instanceof Error ? cause.message : String(cause),
    })
    return new Response('Transient error', { status: 503 })
  }
}
