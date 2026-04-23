import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sharedCookieOptions } from './cookies'

/**
 * Server Supabase client for RSC / Server Actions / Route Handlers.
 *
 * Reads cookies from `next/headers`. A fresh client is created per request —
 * never hoist this into a module-level `const`.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: sharedCookieOptions,
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value, options } of cookiesToSet) {
            // `cookies()` can throw "called from a Server Component" when the
            // caller is an RSC. Ignore — the middleware client writes cookies
            // for us in that path.
            try {
              cookieStore.set(name, value, options as CookieOptions)
            } catch {
              /* noop */
            }
          }
        },
      },
    },
  )
}
