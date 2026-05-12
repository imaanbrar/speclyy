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
 * Header forwarded to downstream Server Components / Actions / Route
 * Handlers carrying the authenticated user's ID. Mirrored in
 * `packages/auth/src/headers.ts` (`USER_ID_HEADER`) — middleware runs in
 * Edge runtime where `next/headers` isn't importable, so we duplicate the
 * literal here and rely on the consumer file to be the source of truth.
 *
 * Set/deleted on every request — never trust an inbound value from the
 * client.
 */
const USER_ID_HEADER = 'x-speclyy-user-id'

/**
 * Single middleware entry point. On every non-static request:
 *   1. Refresh the Supabase session (rewriting Set-Cookie on the response).
 *   2. Stash the user's ID on `x-speclyy-user-id` so pages can skip a
 *      second `auth.getUser` round-trip.
 *   3. Gate unauthenticated requests to `/sign-in?next=<current>`.
 *   4. Gate authenticated-but-not-onboarded requests to `/onboarding/name`.
 *   5. Prevent onboarded users from re-entering `/onboarding/*`.
 *
 * Never throws — on an unexpected error we fall through as unauthenticated
 * (fail closed) so a transient Supabase blip doesn't 500 the whole app.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  // Headers passed to the downstream page request. Wipe any client-supplied
  // user-id header up front; we'll re-set it below only if Supabase confirms
  // the session.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete(USER_ID_HEADER)

  // Buffer Supabase cookie writes and apply them to a single response built
  // at the end. Otherwise each `setAll` callback rebuilds NextResponse.next()
  // and loses the headers we set after auth resolves.
  const pendingCookies: { name: string; value: string; options: CookieOptions }[] = []

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
          // Mirror writes onto the request so subsequent `getAll` reads see
          // them mid-pass (Supabase JS uses this for its own bookkeeping).
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          for (const c of cookiesToSet) pendingCookies.push(c)
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

  // Authoritative now — set/delete based on Supabase's answer.
  if (userId) {
    requestHeaders.set(USER_ID_HEADER, userId)
  } else {
    requestHeaders.delete(USER_ID_HEADER)
  }

  // Build the canonical pass-through response with our final headers + the
  // Supabase cookie writes accumulated above. All non-redirect return paths
  // funnel through here.
  function pass(): NextResponse {
    const res = NextResponse.next({ request: { headers: requestHeaders } })
    for (const { name, value, options } of pendingCookies) {
      res.cookies.set(name, value, options)
    }
    return res
  }

  // API routes are self-authenticating: each route handler calls
  // createServerSupabase() + getUser() and decides on its own (401/403/data).
  // Never short-circuit them with HTML redirects — fetch() callers silently
  // follow a 307 and never hit the actual route, which manifests as "the
  // server never logs the request" + a cancelled request in the network tab
  // when the redirect chain gets interrupted by the next keystroke. The
  // session cookie was already refreshed above via getUser(), so the route
  // handler reads a fresh cookie when it runs.
  if (path.startsWith('/api/')) {
    return pass()
  }

  // Billing pages handle auth + state internally. `/billing/success` is the
  // landing point Stripe redirects to after `confirmPayment` and is the
  // surface that *stamps* `onboarding_completed_at`; gating it through the
  // onboarding-redirect logic below would create a deadlock — a paid-but-
  // not-yet-stamped user gets bounced to `/onboarding/name`, which the
  // success page never had a chance to run.
  //
  // The page itself enforces auth (`if (!user) redirect('/sign-in')`) and
  // verifies the PaymentIntent via Stripe before stamping. Onboarded users
  // hitting `/billing/success` later (e.g. for an upgrade receipt) also
  // need to bypass the onboarded-blocks-onboarding gate, which doesn't
  // apply here — `/billing/*` is not an onboarding path.
  if (path.startsWith('/billing/')) {
    return pass()
  }

  // Unauthenticated gate.
  if (!userId) {
    if (isPublic) {
      return pass()
    }
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
  if (isPublic) {
    return pass()
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

  return pass()
}
