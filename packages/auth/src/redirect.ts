import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Shared post-auth redirect logic. Imported by both `/auth/callback` and
 * `/sign-in/verify` so a user landing via magic-link vs. typed code ends up
 * in the same place.
 */

/**
 * Accepts a `?next=` value from the URL. Returns a safe same-origin path or
 * an empty string if the input is unsafe or absent. Rules:
 *   - Must start with exactly one `/`.
 *   - Must NOT start with `//` (rejects protocol-relative URLs like `//evil.com`).
 *   - Must NOT contain a `\\` (Windows-style separator; some parsers treat it
 *     as `/` and fall through to open redirect).
 *   - Must NOT start with `/auth/` or `/sign-in` (prevents a sign-in → sign-in
 *     loop and blocks bouncing back through the auth callback).
 */
export function sanitizeNext(raw: string | null | undefined): string {
  if (!raw) return ''
  if (typeof raw !== 'string') return ''
  if (!raw.startsWith('/')) return ''
  if (raw.startsWith('//')) return ''
  if (raw.includes('\\')) return ''
  if (raw.startsWith('/auth/') || raw === '/auth') return ''
  if (raw.startsWith('/sign-in') || raw === '/sign-out' || raw.startsWith('/sign-out/')) return ''
  return raw
}

/**
 * Decide where to send the user after an auth exchange succeeds.
 *
 *   1. No authenticated user → `/sign-in?error=unknown`.
 *   2. No profile row yet (edge case; the trigger should have created one) →
 *      treat as not-onboarded so the user proceeds through onboarding.
 *   3. Not onboarded → `/onboarding/name`.
 *   4. Onboarded + valid `next` → `next`.
 *   5. Onboarded, no `next` → `/projects`.
 *
 * **Escape hatch.** When `NEXT_PUBLIC_AUTH_BYPASS_ONBOARDING=1` the onboarding
 * check is skipped and we always return `next || '/projects'` for an
 * authenticated user. This exists so the auth group can be tested end-to-end
 * before the onboarding group ships its Server Actions — the onboarding stubs
 * in `apps/web/src/app/(onboarding)/` don't flip `is_onboarded`, so without
 * this flag a first-time user would be trapped on `/onboarding/name`.
 * **Remove the flag — and this block — when the onboarding group lands.**
 */
export async function decidePostAuthRedirect(
  supabase: SupabaseClient,
  next: string,
): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return '/sign-in?error=unknown'

  if (process.env.NEXT_PUBLIC_AUTH_BYPASS_ONBOARDING === '1') {
    return next || '/projects'
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_onboarded')
    .eq('id', data.user.id)
    .maybeSingle()

  // Defensive: no row → treat as not-onboarded and let the onboarding route
  // (or its middleware) create/repair state.
  if (!profile) return '/onboarding/name'
  if (!profile.is_onboarded) return '/onboarding/name'

  return next || '/projects'
}
