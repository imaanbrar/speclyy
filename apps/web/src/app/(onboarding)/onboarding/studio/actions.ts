'use server'

import { redirect } from 'next/navigation'
import { createServerSupabase } from '@speclyy/auth/server'

const SIZES = ['solo', '2_5', '6_10', '11_plus'] as const
type Size = (typeof SIZES)[number]

export interface StudioActionState {
  errors?: { name?: string; size?: string; form?: string }
  values?: { name: string; size: string }
}

const NAME_MIN = 2
const NAME_MAX = 80

async function findExistingOrgId(): Promise<{ userId: string; orgId: string | null } | null> {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Look for an existing org_member row from a prior pass through this step.
  const { data: member } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .maybeSingle()

  return { userId: user.id, orgId: member?.organization_id ?? null }
}

/**
 * Save (or update) the user's organization with type='studio'. Re-runs of this
 * action mutate the same row pair — never produce a second org/membership.
 */
export async function saveStudio(_prev: StudioActionState, formData: FormData): Promise<StudioActionState> {
  const name = String(formData.get('name') ?? '').trim().replace(/\s+/g, ' ')
  const size = String(formData.get('size') ?? '').trim() as Size | ''

  const errors: NonNullable<StudioActionState['errors']> = {}
  if (name.length < NAME_MIN) errors.name = 'Add a studio name (min 2 characters).'
  else if (name.length > NAME_MAX) errors.name = `Studio name must be ${NAME_MAX} characters or fewer.`
  if (!SIZES.includes(size as Size)) errors.size = 'Pick a studio size.'
  if (Object.keys(errors).length) return { errors, values: { name, size } }

  const ctx = await findExistingOrgId()
  if (!ctx) redirect('/sign-in')

  const supabase = await createServerSupabase()

  if (ctx.orgId) {
    const { error: updateErr } = await supabase
      .from('organizations')
      .update({ name, type: 'studio', size, updated_at: new Date().toISOString() })
      .eq('id', ctx.orgId)
    if (updateErr) {
      return { errors: { form: "Couldn't save your studio. Try again." }, values: { name, size } }
    }
  } else {
    const { data: org, error: insertErr } = await supabase
      .from('organizations')
      .insert({ name, type: 'studio', size })
      .select('id')
      .single()
    if (insertErr || !org) {
      return { errors: { form: "Couldn't save your studio. Try again." }, values: { name, size } }
    }
    const { error: memberErr } = await supabase
      .from('organization_members')
      .insert({ organization_id: org.id, user_id: ctx.userId, role: 'owner' })
    if (memberErr) {
      // Best-effort cleanup so the user isn't pinned to an orphan org on retry.
      await supabase.from('organizations').delete().eq('id', org.id)
      return { errors: { form: "Couldn't save your studio. Try again." }, values: { name, size } }
    }
  }

  redirect('/onboarding/market')
}

/**
 * Skip the studio step. Creates an `individual`-type org named after the user
 * (or "My workspace" as a fallback) so the "every onboarded profile has one
 * organization_members row" invariant still holds.
 */
export async function skipStudio(_formData?: FormData): Promise<void> {
  const ctx = await findExistingOrgId()
  if (!ctx) redirect('/sign-in')

  const supabase = await createServerSupabase()
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', ctx.userId)
    .maybeSingle()

  const displayName =
    `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'My workspace'

  if (ctx.orgId) {
    // Don't downgrade an existing studio just because the user clicked Skip.
    // If they already saved a studio name, advancing here just moves them on.
    redirect('/onboarding/market')
  }

  const { data: org, error: insertErr } = await supabase
    .from('organizations')
    .insert({ name: displayName, type: 'individual', size: null })
    .select('id')
    .single()
  if (insertErr || !org) redirect('/onboarding/market')

  const { error: memberErr } = await supabase
    .from('organization_members')
    .insert({ organization_id: org.id, user_id: ctx.userId, role: 'owner' })
  if (memberErr) {
    await supabase.from('organizations').delete().eq('id', org.id)
  }

  redirect('/onboarding/market')
}
