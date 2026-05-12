import { redirect } from 'next/navigation'
import { createServerSupabase } from '@speclyy/auth/server'
import { getUserIdFromHeaders } from '@speclyy/auth/headers'

import { resolvePlan, type Interval } from '@/lib/billing/plans'

import { OnboardingShell } from '../../_components/shell'
import { CheckoutForm, type PlanSummary } from './_components/checkout-form'

interface PageProps {
  searchParams: Promise<{ interval?: string }>
}

/**
 * `/onboarding/checkout` — interval picker + embedded Stripe Elements.
 *
 * Render preconditions, in order — earliest redirect wins:
 *
 *   1. Authenticated. No user → /sign-in.
 *   2. Not already Pro. Active sub → /projects (avoids a double-charge path
 *      on a stale tab that bypassed the plan-screen guard).
 *
 * The Stripe subscription is **not** created here. Elements is mounted in
 * deferred mode (`mode: 'subscription'`, `amount`, `currency`) and the
 * subscription is created server-side from `actions.ts` only after the user
 * clicks "Pay". This means interval toggles on this page are pure client
 * state — no Stripe round-trip per toggle, no orphan `incomplete` subs.
 *
 * `?interval=` is read for the initial pick (default annual). The picker
 * lets the user switch on the page itself; URL is kept in sync via
 * `router.replace` for reload-resilience.
 *
 * See:
 *   - docs/architecture/billing.md § "Checkout flow"
 *   - docs/architecture/adr/0018-payment-surface.md — embedded Elements
 */
export default async function OnboardingCheckoutPage({ searchParams }: PageProps) {
  const userId = await getUserIdFromHeaders()
  if (!userId) redirect('/sign-in')

  const supabase = await createServerSupabase()
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle()
  if (existing?.status === 'active') redirect('/projects')

  const { interval: intervalRaw } = await searchParams
  const initialInterval: Interval = intervalRaw === 'monthly' ? 'monthly' : 'annual'

  const plans: Record<Interval, PlanSummary> = {
    annual: toSummary(resolvePlan('annual')),
    monthly: toSummary(resolvePlan('monthly')),
  }

  return (
    <OnboardingShell
      step={4}
      eyebrow="Checkout"
      title={
        <>
          One last <span className="italic-serif">step.</span>
        </>
      }
      description="Pick your billing interval and add your card. Renews automatically — cancel any time from Settings."
    >
      <CheckoutForm initialInterval={initialInterval} plans={plans} />
    </OnboardingShell>
  )
}

function toSummary(plan: ReturnType<typeof resolvePlan>): PlanSummary {
  return {
    interval: plan.interval,
    label: plan.label,
    amount: plan.amount,
    amountMonthlyEquivalent: plan.amountMonthlyEquivalent,
    currency: plan.currency,
    annualEquivalentLabel: plan.annualEquivalentLabel,
  }
}
