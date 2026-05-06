import { redirect } from 'next/navigation'
import { createServerSupabase } from '@speclyy/auth/server'
import { getUserIdFromHeaders } from '@speclyy/auth/headers'
import { OnboardingShell } from '../../_components/shell'
import { StudioForm } from './_components/studio-form'

export default async function OnboardingStudioPage() {
  // Middleware already validated and set `x-speclyy-user-id` — read from
  // there instead of doing a second auth.getUser() round-trip (~110ms).
  const userId = await getUserIdFromHeaders()
  if (!userId) redirect('/sign-in')

  const supabase = await createServerSupabase()

  // Pull any prior studio data so the form pre-fills on revisit. Joins
  // organization_members → organizations to find the user's existing org.
  const { data: member } = await supabase
    .from('organization_members')
    .select('organization_id, organizations(name, type, size)')
    .eq('user_id', userId)
    .maybeSingle()

  const org = (member as unknown as { organizations?: { name: string; type: string; size: string | null } } | null)?.organizations
  // If a previous Skip created an `individual` org we treat the form as empty —
  // the user is now choosing to declare a real studio.
  const initial = {
    name: org && org.type === 'studio' ? org.name : '',
    size: org && org.type === 'studio' && org.size ? org.size : '',
  }

  return (
    <OnboardingShell
      step={2}
      eyebrow="Your studio"
      title={
        <>
          Where do you <span className="italic-serif">practice?</span>
        </>
      }
      description="The studio name appears as the letterhead on every PDF you export. You can add this later in Settings."
    >
      <StudioForm initial={initial} />
    </OnboardingShell>
  )
}
