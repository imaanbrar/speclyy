'use server'

import { redirect } from 'next/navigation'
import { createServerSupabase } from '@speclyy/auth/server'

export interface PlanActionState {
  errors?: { form?: string }
}

/**
 * Free path: stamps `profiles.onboarding_completed_at` (guarded so a double
 * submit doesn't bump the timestamp) and lands the user on the welcome screen.
 *
 * Pro path: redirects to `/onboarding/checkout`. The Stripe subscription is
 * created on the checkout page when the user clicks "Pay" — keeps the plan
 * step a pure UI choice and avoids leaving orphan `incomplete` subscriptions
 * in Stripe when users bounce or change their mind on interval.
 */
export async function continueOnboarding(
  _prev: PlanActionState,
  formData: FormData,
): Promise<PlanActionState> {
  const plan = String(formData.get('plan') ?? 'free')

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  if (plan === 'pro') {
    redirect('/onboarding/checkout')
  }

  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', user.id)
    .is('onboarding_completed_at', null)

  if (error) {
    return { errors: { form: "Couldn't finish setup. Try again." } }
  }

  redirect('/welcome')
}
