import 'server-only'

/**
 * Plan + price catalog — single source of truth for the Pro plan's price IDs
 * and display copy.
 *
 * **Stage: TASK-BILL-01 — USD only.**
 *
 * The Stripe dashboard (and `.env.local`) carries all four price IDs
 * (USD + CAD), but only the USD pair is read here. `STRIPE_PRICE_ID_PRO_*_CAD`
 * are populated but unread; TASK-BILL-09 restructures this file to a
 * currency-keyed shape:
 *
 *     resolvePlan('USD' | 'CAD', 'monthly' | 'annual')
 *
 * Until then, callers (createProSubscription, plan screen, portal copy) call
 * `resolvePlan(interval)` and get the USD plan back.
 *
 * Lazy: the env reads happen on the first `resolvePlan` call, not at module
 * load. Same reason as `stripe.ts` — Next.js's "Collecting page data" phase
 * statically loads route modules, and an eager throw breaks the build for
 * routes that don't actually need Stripe.
 *
 * See:
 *   - docs/architecture/billing.md § "Subscription model"
 *   - docs/implementation-tasks/billing-subscription/TASK-BILL-01-stripe-provisioning.md
 *   - docs/implementation-tasks/billing-subscription/TASK-BILL-09-cad-pricing-expansion.md
 */

export type Interval = 'monthly' | 'annual'

export interface Plan {
  priceId: string
  /** Cents-free display amount (per billing interval). */
  amount: number
  /** Effective monthly amount for marketing copy. Equals `amount` for monthly. */
  amountMonthlyEquivalent: number
  currency: 'USD'
  interval: Interval
  /** Headline price label, e.g. "$37/mo USD". */
  label: string
  /** Sub-label or annual-equivalent caption. `null` for monthly. */
  annualEquivalentLabel: string | null
}

let memo: Record<Interval, Plan> | null = null

function loadPlans(): Record<Interval, Plan> {
  if (memo) return memo

  const monthlyPriceId = process.env.STRIPE_PRICE_ID_PRO_MONTHLY_USD
  const annualPriceId = process.env.STRIPE_PRICE_ID_PRO_ANNUAL_USD

  if (!monthlyPriceId || !annualPriceId) {
    throw new Error(
      'STRIPE_PRICE_ID_PRO_MONTHLY_USD and STRIPE_PRICE_ID_PRO_ANNUAL_USD must be set. ' +
        'See apps/web/.env.local.example and the Speclyy Pro product in the Stripe dashboard.',
    )
  }

  memo = {
    monthly: {
      priceId: monthlyPriceId,
      amount: 37,
      amountMonthlyEquivalent: 37,
      currency: 'USD',
      interval: 'monthly',
      label: '$37/mo USD',
      annualEquivalentLabel: null,
    },
    annual: {
      priceId: annualPriceId,
      amount: 348,
      amountMonthlyEquivalent: 29,
      currency: 'USD',
      interval: 'annual',
      label: '$348/yr USD',
      annualEquivalentLabel: '$29/mo USD billed annually',
    },
  }
  return memo
}

/**
 * Resolve a plan config by interval. BILL-09 will replace this with
 * `resolvePlan(currency, interval)`.
 */
export function resolvePlan(interval: Interval): Plan {
  return loadPlans()[interval]
}
