'use server'

import { redirect } from 'next/navigation'
import { createServerSupabase } from '@speclyy/auth/server'

export interface MarketActionState {
  errors?: { market?: string; form?: string }
  values?: { market: string }
}

const MAX = 120

export async function saveMarket(_prev: MarketActionState, formData: FormData): Promise<MarketActionState> {
  const market = String(formData.get('market') ?? '').trim().replace(/\s+/g, ' ')

  if (market.length === 0) {
    return { errors: { market: 'Pick a city to continue.' }, values: { market } }
  }
  if (market.length > MAX) {
    return { errors: { market: `Pick a shorter label (max ${MAX} characters).` }, values: { market } }
  }

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { error } = await supabase
    .from('profiles')
    .update({ market, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    return { errors: { form: "Couldn't save your market. Try again." }, values: { market } }
  }

  redirect('/onboarding/plan')
}
