import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client.
 *
 * **Server-only.** Uses `SUPABASE_SECRET_KEY` and bypasses Row-Level Security.
 * Intended for the Stripe webhook handler and ops scripts — never import from
 * anything under an `app/` client boundary.
 *
 * The guard below throws at import time if this module is ever bundled into
 * browser code, so a stray client-side import fails loudly the first time the
 * page loads rather than silently shipping the secret to the user.
 */
if (typeof window !== 'undefined') {
  throw new Error(
    '@speclyy/auth/service-role was imported from a client boundary. ' +
      'This module uses SUPABASE_SECRET_KEY and must only run on the server.',
  )
}

export function createServiceRoleSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!url) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL')
  if (!secret) throw new Error('Missing env: SUPABASE_SECRET_KEY')

  return createClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}
