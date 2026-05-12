'use server'

import { redirect } from 'next/navigation'
import { createServerSupabase } from '@speclyy/auth/server'

export interface NameActionState {
  errors?: { first_name?: string; last_name?: string; form?: string }
  values?: { first_name: string; last_name: string }
}

const MIN = 2
const MAX = 40

function validate(first: string, last: string): NameActionState['errors'] | null {
  const errors: NonNullable<NameActionState['errors']> = {}
  if (first.length < MIN) errors.first_name = `Must be at least ${MIN} characters.`
  else if (first.length > MAX) errors.first_name = `Must be at most ${MAX} characters.`
  if (last.length < MIN) errors.last_name = `Must be at least ${MIN} characters.`
  else if (last.length > MAX) errors.last_name = `Must be at most ${MAX} characters.`
  return Object.keys(errors).length ? errors : null
}

export async function saveName(_prev: NameActionState, formData: FormData): Promise<NameActionState> {
  const first_name = String(formData.get('first_name') ?? '').trim()
  const last_name = String(formData.get('last_name') ?? '').trim()

  const errors = validate(first_name, last_name)
  if (errors) return { errors, values: { first_name, last_name } }

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  // Upsert (not update) so this step also self-heals a missing profile row.
  // The handle_new_user trigger creates the row at signup, so the INSERT
  // path here only fires for the rare user created out-of-band (manual SQL
  // insert, etc.). Replaces the per-page `ensureProfile()` call previously
  // run from `(onboarding)/layout.tsx`.
  const { error } = await supabase
    .from('profiles')
    .upsert(
      { id: user.id, first_name, last_name, updated_at: new Date().toISOString() },
      { onConflict: 'id' },
    )

  if (error) {
    console.error('[onboarding/name] profiles upsert failed', {
      userId: user.id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
    return {
      errors: { form: "Couldn't save your name. Try again." },
      values: { first_name, last_name },
    }
  }

  redirect('/onboarding/studio')
}
