import 'server-only'

/**
 * Discriminated union of billing failures the UI needs to differentiate.
 *
 * The Server Action throws `BillingError` instead of returning a `{ ok, data
 * | error }` shape because the checkout page (TASK-BILL-04) consumes the
 * action like:
 *
 *     const { clientSecret } = await createProSubscription(interval)
 *
 * — i.e. it destructures the success path directly. A thrown `BillingError`
 * lets the page do `try/catch` and render `error.code`-keyed copy without
 * parsing Stripe's free-form messages.
 *
 * Codes:
 *   - `unauthenticated`     — `supabase.auth.getUser()` returned null. Action
 *                             refused before touching Stripe.
 *   - `already_subscribed`  — caller already has `subscriptions.status =
 *                             'active'`. Short-circuits to prevent double-
 *                             charging if the plan screen misfires.
 *   - `stripe_error`        — Stripe API rejected the request (declined card,
 *                             invalid price, network blip). The original
 *                             Stripe message is preserved on `cause` for
 *                             logging; never surface it raw to users.
 *
 * See:
 *   - docs/implementation-tasks/billing-subscription/TASK-BILL-03-create-pro-subscription-action.md
 *     § "Error types"
 */
export type BillingErrorCode =
  | 'unauthenticated'
  | 'already_subscribed'
  | 'stripe_error'

export class BillingError extends Error {
  /** Discriminator the UI maps to copy. Stable across releases. */
  readonly code: BillingErrorCode

  constructor(code: BillingErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'BillingError'
    this.code = code
  }
}

export function isBillingError(value: unknown): value is BillingError {
  return value instanceof BillingError
}
