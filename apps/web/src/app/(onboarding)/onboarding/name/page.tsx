import { redirect } from 'next/navigation'
import { createServerSupabase } from '@speclyy/auth/server'
import { OnboardingShell } from '../../_components/shell'
import { NameForm } from './_components/name-form'

export default async function OnboardingNamePage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <OnboardingShell
      step={1}
      eyebrow="About you"
      title={
        <>
          What should we <span className="italic-serif">call you?</span>
        </>
      }
      description="This appears on your spec sheets alongside your studio."
    >
      <NameForm
        email={user.email ?? ''}
        initial={{
          first_name: profile?.first_name ?? '',
          last_name: profile?.last_name ?? '',
        }}
      />
    </OnboardingShell>
  )
}
