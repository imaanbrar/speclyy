'use client'

import { loadStripe, type Stripe as StripeJs } from '@stripe/stripe-js'

/**
 * Browser-side Stripe.js singleton.
 *
 * `loadStripe` returns a `Promise<Stripe | null>` — the SDK is fetched once
 * (no double-loads if multiple components mount in the same session). We
 * memoize the promise here so React strict-mode double-renders + multiple
 * `<Elements>` providers reuse the same instance.
 *
 * Imported only by Client Components (`'use client'` is at the top so a
 * stray server import errors loud, since this module reads
 * `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` from the bundle).
 *
 * The publishable key is the only Stripe credential that's safe to ship in
 * the browser bundle — `pk_test_…` in dev/preview, `pk_live_…` in prod.
 *
 * See:
 *   - docs/architecture/billing.md § "Checkout flow · Client"
 *   - docs/implementation-tasks/billing-subscription/TASK-BILL-04-checkout-elements-page.md
 */

let memo: Promise<StripeJs | null> | null = null

export function getStripeJs(): Promise<StripeJs | null> {
  if (memo) return memo

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!publishableKey) {
    // Fail loud at first use rather than silently returning a null Promise —
    // an unconfigured env in preview/prod would leave the user staring at an
    // empty PaymentElement otherwise.
    throw new Error(
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Configure it in apps/web/.env.local (and the matching Vercel scope).',
    )
  }

  memo = loadStripe(publishableKey)
  return memo
}
