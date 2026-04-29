import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabase } from '@speclyy/auth/server'
import { sanitizeNext, decidePostAuthRedirect } from '@speclyy/auth/redirect'

/**
 * `/auth/callback` — terminates Google OAuth + magic-link round-trips.
 *
 *   1. Provider error → `/sign-in?error=oauth_denied` (and no cookies set).
 *   2. Missing `code` → `/sign-in?error=unknown`.
 *   3. `exchangeCodeForSession` fails → map to `otp_expired` or `oauth_failed`.
 *   4. Success → `decidePostAuthRedirect` decides onboarding vs next vs /projects.
 *
 * Never throws. Any unexpected error falls through to `/sign-in?error=unknown`.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = sanitizeNext(url.searchParams.get('next'))
  const oauthError = url.searchParams.get('error')

  try {
    if (oauthError) {
      const tag = oauthError === 'access_denied' ? 'oauth_denied' : 'oauth_failed'
      return NextResponse.redirect(new URL(`/sign-in?error=${tag}`, request.url))
    }

    if (!code) {
      return NextResponse.redirect(new URL('/sign-in?error=unknown', request.url))
    }

    const supabase = await createServerSupabase()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      // Fragile-but-acceptable heuristic: Supabase's OTP-expired errors
      // include "expired" in the message. If wording changes we fall through
      // to the generic oauth_failed tag.
      const tag = error.message?.toLowerCase().includes('expired')
        ? 'otp_expired'
        : 'oauth_failed'
      return NextResponse.redirect(new URL(`/sign-in?error=${tag}`, request.url))
    }

    const target = await decidePostAuthRedirect(supabase, next)
    return NextResponse.redirect(new URL(target, request.url))
  } catch {
    return NextResponse.redirect(new URL('/sign-in?error=unknown', request.url))
  }
}
