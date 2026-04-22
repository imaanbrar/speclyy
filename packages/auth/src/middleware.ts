import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refresh the Supabase session on every request and return a NextResponse
 * with the refreshed cookies already attached. Compose gate helpers on top.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
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

  await supabase.auth.getUser()
  return response
}

/** Each app composes the gates it needs. Return a redirect to short-circuit, or null to continue. */
export function requireAuth(_req: NextRequest, _res: NextResponse): NextResponse | null {
  // TODO: read user from cookies; redirect to /sign-in on the app's own domain if absent.
  return null
}

export function requireOnboarding(_req: NextRequest, _res: NextResponse): NextResponse | null {
  // TODO: check profiles.onboarding_completed; redirect to /onboarding/name.
  return null
}

export function requireActiveSubscription(_req: NextRequest, _res: NextResponse): NextResponse | null {
  // TODO: check subscriptions.status; redirect to /billing if lapsed.
  return null
}
