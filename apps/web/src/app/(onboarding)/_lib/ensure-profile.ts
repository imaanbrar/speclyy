import 'server-only'
import { createServerSupabase } from '@speclyy/auth/server'

/**
 * Belt-and-braces profile upsert. The `handle_new_user` trigger from
 * TASK-AUTH-02 is the source of truth — this exists so the onboarding flow
 * self-heals if a row is somehow missing (e.g. a user created manually before
 * the trigger ran). Idempotent and column-scoped: never writes default values
 * for columns later steps will populate.
 */
export async function ensureProfile(userId: string): Promise<void> {
  const supabase = await createServerSupabase()
  // ON CONFLICT (id) DO NOTHING — Supabase JS exposes this via upsert with
  // ignoreDuplicates. Only the primary key is touched.
  await supabase.from('profiles').upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true })
}
