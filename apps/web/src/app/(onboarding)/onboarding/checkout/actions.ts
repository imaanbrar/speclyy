'use server'

import { createProSubscription } from '@/app/(billing)/billing/actions'
import { isBillingError } from '@/lib/billing/errors'
import type { Interval } from '@/lib/billing/plans'

export type CheckoutFailureCode =
  | 'unauthenticated'
  | 'already_subscribed'
  | 'stripe_error'
  | 'invalid_interval'

export type CheckoutActionResult =
  | { ok: true; clientSecret: string }
  | { ok: false; code: CheckoutFailureCode; message: string }

const VALID_INTERVALS: ReadonlyArray<Interval> = ['monthly', 'annual']

/**
 * `startProCheckout` — creates the Stripe subscription for the chosen interval
 * and returns the `clientSecret` the browser hands to `stripe.confirmPayment`.
 *
 * Called from the checkout form **after** the user clicks "Pay" and
 * `elements.submit()` validates the card. Deferring creation to this point
 * (instead of the plan step) means interval toggles on the checkout page are
 * pure client state — Stripe never sees an `incomplete` subscription the user
 * abandoned mid-flow.
 *
 * Errors are returned as `{ ok: false, code }` rather than thrown so the
 * client can branch on the discriminator without try/catch around the action.
 * `BillingError` codes (`unauthenticated`, `already_subscribed`,
 * `stripe_error`) are forwarded; the client maps them to redirects or copy.
 */
export async function startProCheckout(interval: Interval): Promise<CheckoutActionResult> {
  if (!VALID_INTERVALS.includes(interval)) {
    return { ok: false, code: 'invalid_interval', message: 'Pick a valid billing interval.' }
  }

  try {
    const { clientSecret } = await createProSubscription(interval)
    return { ok: true, clientSecret }
  } catch (error) {
    if (isBillingError(error)) {
      return { ok: false, code: error.code, message: error.message }
    }
    console.error('startProCheckout.unexpected', error)
    return { ok: false, code: 'stripe_error', message: 'Something went wrong. Please try again.' }
  }
}
