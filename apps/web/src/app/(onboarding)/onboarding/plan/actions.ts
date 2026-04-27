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
 * Pro path: routed to `/onboarding/checkout` — that page (TASK-BILL-04) owns
 * `createProSubscription` and calls `completeOnboarding` only on success.
 * Returning here from a half-finished Stripe session leaves the user able to
 * complete onboarding on Free.
 */
export async function continueOnboarding(_prev: PlanActionState, formData: FormData): Promise<PlanActionState> {
  const plan = String(formData.get('plan') ?? 'free')
  const interval = String(formData.get('interval') ?? 'annual')

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  if (plan === 'pro') {
    // Hand off to the billing group. Until TASK-BILL-04 lands, the route
    // renders a placeholder. The interval is forwarded so billing can read it.
    redirect(`/onboarding/checkout?interval=${encodeURIComponent(interval)}`)
  }

  // Free path — guarded write so a double-click can't produce two timestamps.
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
