import { createBrowserClient } from '@supabase/ssr'
import { sharedCookieOptions } from './cookies'

/**
 * Browser Supabase client for Client Components.
 *
 * Only reads `NEXT_PUBLIC_*` envs so it is safe to call from code that ships
 * to the user. `SUPABASE_SECRET_KEY` must NEVER reach this factory.
 *
 * The cookie-domain option matches the server/middleware factories so any
 * cookies the browser client sets (mostly the PKCE `code_verifier`) share the
 * same scope as the session cookies Supabase writes from the server.
 */
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: sharedCookieOptions,
    },
  )
}
