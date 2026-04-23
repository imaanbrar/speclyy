import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabase } from '@speclyy/auth/server'

/**
 * `/auth/sign-out` — POST-only.
 *
 * Revokes the refresh token server-side and clears every `sb-*` cookie, then
 * 303-redirects to `/sign-in`. A full-page navigation is deliberate: it drops
 * every in-memory client cache (React Query, Zustand, etc.) so a subsequent
 * login on the same browser starts clean.
 *
 * GET returns 405 as CSRF hardening — a stray `<img src="/auth/sign-out">` on
 * a phishing page should not be able to log a visitor out.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  // Idempotent: double-submit from a double-clicked form must not 500.
  await supabase.auth.signOut().catch(() => {
    /* already signed out */
  })
  return NextResponse.redirect(new URL('/sign-in', request.url), { status: 303 })
}

export function GET() {
  return new NextResponse('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  })
}
