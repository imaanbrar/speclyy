import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { sharedCookieOptions } from './cookies'
import { sanitizeNext } from './redirect'

/**
 * Paths that do NOT require a session. Every other path is gated.
 *
 * Both `/auth/sign-out` (Route Handler) and `/sign-out` (legacy UI surface)
 * must be public so mid-onboarding or expired-session users can still sign
 * out without a redirect loop.
 */
const PUBLIC_PATHS = [
  '/',
  '/sign-in',
  '/auth/callback',
  '/auth/sign-out',
  '/sign-out',
  '/privacy',
  '/terms',
] as const

function isPublicPath(path: string): boolean {
  if (PUBLIC_PATHS.includes(path as (typeof PUBLIC_PATHS)[number])) return true
  // Nested auth pages (e.g. /sign-in/verify) are public too.
  if (path.startsWith('/sign-in/')) return true
  if (path.startsWith('/auth/')) return true
  return false
}

/**
 * Single middleware entry point. On every non-static request:
 *   1. Refresh the Supabase session (rewriting Set-Cookie on the response).
 *   2. Gate unauthenticated requests to `/sign-in?next=<current>`.
 *   3. Gate authenticated-but-not-onboarded requests to `/onboarding/name`.
 *   4. Prevent onboarded users from re-entering `/onboarding/*`.
 *
 * Never throws — on an unexpected error we fall through as unauthenticated
 * (fail closed) so a transient Supabase blip doesn't 500 the whole app.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: sharedCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  const path = request.nextUrl.pathname
  const isPublic = isPublicPath(path)

  let userId: string | null = null
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch {
    userId = null
  }

  // Unauthenticated gate.
  if (!userId) {
    if (isPublic) return response
    const signIn = new URL('/sign-in', request.url)
    // Preserve the originally-requested URL (path + search) via ?next=.
    const current = path + request.nextUrl.search
    const safe = sanitizeNext(current)
    if (safe) signIn.searchParams.set('next', safe)
    return NextResponse.redirect(signIn)
  }

  // Authenticated. Public paths still render (e.g. /sign-in → user will be
  // bounced to /projects by the page itself if desired), but we skip the
  // onboarding DB read to keep these routes fast.
  if (isPublic) return response

  // Escape hatch — see decidePostAuthRedirect for the rationale. When this
  // flag is on we skip the onboarding gate entirely so the auth group can be
  // tested before the onboarding group ships its Server Actions. Remove this
  // branch when onboarding lands.
  if (process.env.NEXT_PUBLIC_AUTH_BYPASS_ONBOARDING === '1') {
    return response
  }

  // Onboarding gate — single typed read.
  let isOnboarded = false
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_onboarded')
      .eq('id', userId)
      .maybeSingle()
    isOnboarded = Boolean(profile?.is_onboarded)
  } catch {
    // Fail closed: no profile row means we haven't finished onboarding.
    isOnboarded = false
  }

  const isOnboardingPath = path.startsWith('/onboarding')
  if (!isOnboarded && !isOnboardingPath) {
    return NextResponse.redirect(new URL('/onboarding/name', request.url))
  }
  if (isOnboarded && isOnboardingPath) {
    return NextResponse.redirect(new URL('/projects', request.url))
  }

  return response
}
