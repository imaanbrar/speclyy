'use server'

import { createServerSupabase } from '@speclyy/auth/server'

import { BillingError } from '@/lib/billing/errors'
import { resolvePlan, type Interval } from '@/lib/billing/plans'
import { stripe, type Stripe } from '@/lib/billing/stripe'

/**
 * `createProSubscription` — server-side Pro purchase primitive.
 *
 * Returns a `clientSecret` the browser hands to Stripe Elements'
 * `confirmPayment`. The DB row is **not** written here — `subscriptions` is
 * written exclusively by the webhook handler (TASK-BILL-05) on
 * `customer.subscription.created`. Keeping a single writer prevents the
 * action and the webhook from racing on the same row.
 *
 * **Stage: TASK-BILL-01 — USD only.** Signature accepts `interval` only;
 * `currency` is hardcoded to `USD` in the Stripe metadata. TASK-BILL-09
 * widens the signature to `(interval, currency)` and looks up the price via
 * `PLANS[currency][interval]`.
 *
 * Failure modes are surfaced as `BillingError` with a stable `code`. The
 * checkout page (TASK-BILL-04) maps the code to inline copy without parsing
 * Stripe's free-form messages.
 *
 * See:
 *   - docs/architecture/billing.md § "Checkout flow" — reference impl.
 *   - docs/implementation-tasks/billing-subscription/TASK-BILL-03-create-pro-subscription-action.md
 *   - docs/architecture/adr/0017-subscription-ownership.md — `metadata.userId`
 *   - docs/architecture/adr/0018-payment-surface.md — embedded Elements (not Checkout)
 */
export async function createProSubscription(
  interval: Interval,
): Promise<{ clientSecret: string; subscriptionId: string }> {
  // ----- 1. Auth -----
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new BillingError('unauthenticated', 'You must be signed in to subscribe.')
  }
  if (!user.email) {
    // Supabase emits users without email only via custom auth providers we
    // don't use; if this ever fires, treat as an unrecoverable state error.
    throw new BillingError('unauthenticated', 'Account is missing an email address.')
  }

  // ----- 2. Existing subscription state -----
  // Read both the customer ID (for dedup) and the status (for the
  // already-active short-circuit) in a single round-trip.
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id, status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing?.status === 'active') {
    throw new BillingError(
      'already_subscribed',
      "You're already on Pro. Manage billing from your account settings.",
    )
  }

  // ----- 3. Resolve or create Stripe customer -----
  // Reuse the customer if a row exists (even if past_due / canceled — the
  // user keeps the same Stripe customer across resubs). If absent, create
  // and let the webhook persist the ID; we deliberately do not write to
  // `subscriptions` here per the single-writer invariant.
  let customerId = existing?.stripe_customer_id ?? null
  if (!customerId) {
    try {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      })
      customerId = customer.id
    } catch (cause) {
      // Log the underlying Stripe error so it shows up in `pnpm dev` /
      // Vercel logs. The `BillingError` we throw here only carries
      // user-safe copy; the real diagnostic (`Stripe…Error`, code,
      // `param`, `requestId`) lives on `cause` and would otherwise be
      // swallowed silently when the form re-renders.
      logStripeFailure('customers.create', cause, { userId: user.id })
      throw new BillingError(
        'stripe_error',
        "We couldn't reach the payments provider. Please try again.",
        { cause },
      )
    }
  }

  // ----- 4. Create subscription -----
  const plan = resolvePlan(interval)
  let subscription: Stripe.Subscription
  try {
    subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: plan.priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      // Stripe Tax handles GST/HST for Canadian customers via the registered
      // tax IDs in the dashboard. US-state tax stays off until economic
      // nexus is hit (Stage 2 — see docs/business/stages.md).
      //
      // Gated on `STRIPE_AUTOMATIC_TAX` so local dev can run end-to-end
      // without configuring Stripe Tax + a customer billing address.
      // Production sets the env var to `'true'` per TASK-BILL-01. When the
      // checkout form is widened to collect a billing address (Stripe
      // `<AddressElement>` + `customer_update: { address: 'auto' }`), this
      // flag becomes redundant — track removal in TASK-BILL-09 cleanup.
      automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === 'true' },
      // API version 2026-04-22.dahlia surfaces the client_secret on
      // `invoice.confirmation_secret` instead of the now-removed
      // `invoice.payment_intent`. We expand it explicitly because Stripe
      // treats secret-bearing fields as opt-in to keep them out of default
      // responses.
      expand: ['latest_invoice.confirmation_secret'],
      // BILL-09 will widen `currency` to a param. Today the only price IDs
      // wired into plans.ts are USD, so hardcoding here matches the catalog.
      metadata: { userId: user.id, currency: plan.currency },
    })
  } catch (cause) {
    logStripeFailure('subscriptions.create', cause, {
      userId: user.id,
      customerId,
      priceId: plan.priceId,
      interval,
    })
    throw new BillingError(
      'stripe_error',
      "We couldn't start your subscription. Please try again.",
      { cause },
    )
  }

  // ----- 5. Pull the client_secret out of the expanded invoice -----
  // 2026-04-22.dahlia: the client_secret rides on
  // `latest_invoice.confirmation_secret` (was `payment_intent.client_secret`
  // pre-API-version bump). The shape is `{ client_secret, type }` where
  // `type` is currently always `'payment_intent'`, so what we hand to
  // `stripe.confirmPayment` on the client is the same `pi_…_secret_…`
  // string the SDK expects.
  const latestInvoice = subscription.latest_invoice
  if (!latestInvoice || typeof latestInvoice === 'string') {
    throw new BillingError(
      'stripe_error',
      'Subscription created but payment setup is incomplete. Please retry.',
    )
  }
  const clientSecret = latestInvoice.confirmation_secret?.client_secret
  if (!clientSecret) {
    // No secret on the invoice means Stripe didn't auto-create a
    // PaymentIntent — typically because the invoice total is $0 (full-off
    // coupon, trial). MVP doesn't support either path; if this fires it's
    // alert-worthy.
    throw new BillingError(
      'stripe_error',
      'Subscription created but payment setup is incomplete. Please retry.',
    )
  }

  // Info-level breadcrumb. NEVER log clientSecret or anything from the
  // payment intent's body — the secret is exactly the "secret" part.
  console.log(
    JSON.stringify({
      msg: 'createProSubscription.ok',
      userId: user.id,
      subscriptionId: subscription.id,
      interval,
      currency: plan.currency,
    }),
  )

  return {
    clientSecret,
    subscriptionId: subscription.id,
  }
}

/**
 * Structured error log for failed Stripe SDK calls. Pulls the diagnostic
 * fields off Stripe's typed error classes (`StripeInvalidRequestError`,
 * `StripeAuthenticationError`, etc.) without logging the full error object —
 * Stripe error bodies can echo back request payloads we passed in, and we
 * never want a customer email or metadata blob ending up in shared logs.
 *
 * Always logged at `error` level so the dev terminal surfaces it even when
 * the action's own `console.error` was silenced.
 */
function logStripeFailure(
  op: 'customers.create' | 'subscriptions.create',
  cause: unknown,
  context: Record<string, unknown>,
): void {
  const e = cause as Partial<{
    type: string
    code: string
    param: string
    statusCode: number
    requestId: string
    message: string
  }>
  console.error(
    JSON.stringify({
      msg: 'createProSubscription.stripe_failure',
      op,
      type: e?.type,
      code: e?.code,
      param: e?.param,
      statusCode: e?.statusCode,
      requestId: e?.requestId,
      message: e?.message,
      ...context,
    }),
  )
}

