import { redirect } from 'next/navigation'
import { createServerSupabase } from '@speclyy/auth/server'
import { ensureProfile } from './_lib/ensure-profile'

/**
 * Route-group layout shared by every `/onboarding/*` step.
 *
 * Middleware already enforces auth + the onboarded gate; this layout is
 * defensive only. It guarantees a `profiles` row exists before any step's
 * Server Action runs (`ensureProfile`), and bounces fully-onboarded users to
 * `/projects` if they end up here directly.
 *
 * `/welcome` lives in a sibling route group so this gate doesn't touch it.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  await ensureProfile(user.id)

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_onboarded')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.is_onboarded) redirect('/projects')

  return <>{children}</>
}
