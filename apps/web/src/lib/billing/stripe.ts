import 'server-only'

import Stripe from 'stripe'

/**
 * Server-side Stripe SDK singleton — **lazy**.
 *
 * Imported by Server Actions (createProSubscription, customer portal action),
 * the webhook handler, and any server-only billing helper. The `'server-only'`
 * import at the top guarantees that pulling this file into a Client Component
 * is a build-time error rather than a runtime credential leak.
 *
 * The exported `stripe` is a Proxy that constructs the real client on first
 * property access, then memoizes it. Lazy because Next.js's "Collecting page
 * data" build phase loads route modules statically — a throw at module load
 * (e.g. when `STRIPE_SECRET_KEY` is unset) would break the build, even for
 * routes that don't need Stripe. Lazy also keeps the module importable from
 * tests and tooling without booting the SDK.
 *
 * The API version is pinned to the version the installed SDK was generated
 * against. Bumping the SDK + the pinned version is one PR; never let them
 * drift independently.
 *
 * See:
 *   - docs/architecture/billing.md — usage shape
 *   - docs/business/stripe-account.md — keys + W-8BEN-E + Stripe Tax setup
 *   - docs/implementation-tasks/billing-subscription/TASK-BILL-01-stripe-provisioning.md
 */

let memo: Stripe | null = null

function getStripe(): Stripe {
  if (memo) return memo

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. See apps/web/.env.local.example.',
    )
  }

  memo = new Stripe(secretKey, {
    apiVersion: '2026-04-22.dahlia',
    typescript: true,
    // Identifies our requests in Stripe's logs — useful when triaging issues
    // through Stripe support or filtering Sigma queries.
    appInfo: {
      name: 'Speclyy',
      url: 'https://speclyy.com',
    },
  })
  return memo
}

/**
 * Proxy front-end so callers can keep `import { stripe } from '...'` while
 * deferring construction (and the env-var check) until the first method
 * call. Function values are bound to the real client so `this` resolves
 * correctly inside SDK methods.
 */
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    const real = getStripe() as unknown as Record<string | symbol, unknown>
    const value = Reflect.get(real, prop, receiver)
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value
  },
})

export type { Stripe }
