import { NextResponse } from 'next/server'
import { createServerSupabase } from '@speclyy/auth/server'

import type { SubscriptionStatus } from '@/lib/billing/subscription-writer'

/**
 * `GET /api/billing/status` — returns `{ status: SubscriptionStatus | null }`
 * for the **currently signed-in user**, polled by the Pro Success page while
 * waiting for the activating webhook to land.
 *
 * Why user-authenticated (not service-role)?
 *
 *   The poller runs in the browser. Service-role would bypass RLS and let
 *   any caller swap in another user's id. By going through `createServerSupabase()`
 *   we re-use the session cookie + Supabase RLS to enforce "you can only see
 *   your own subscription row" at the DB level — same surface as every other
 *   user-scoped read.
 *
 * Unauthenticated → 401. The Success page itself redirects to `/sign-in`
 * before this endpoint ever fires; the 401 is defense-in-depth for direct
 * `fetch()` calls from a logged-out tab.
 *
 * `Cache-Control: no-store` is intentional. The whole point of polling is to
 * pick up state changes from the webhook landing seconds after the page
 * renders — caching at any layer would defeat the loop.
 *
 * See:
 *   - docs/implementation-tasks/billing-subscription/TASK-BILL-06-pro-success-screen.md
 *     § "Implementation notes · Status endpoint"
 *   - docs/architecture/billing.md § "Success / cancel return"
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface StatusResponse {
  /** `null` if the user has no `subscriptions` row at all (Free user). */
  status: SubscriptionStatus | null
}

export async function GET(): Promise<NextResponse<StatusResponse | { error: string }>> {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // RLS already restricts to `user_id = auth.uid()`; the explicit `.eq()`
  // makes the intent unambiguous and is a no-op under correctly-scoped
  // policies. `maybeSingle()` returns `null` for "no row" without erroring,
  // which is the Free-user case.
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[billing/status] read failed:', error)
    return NextResponse.json({ error: 'read_failed' }, { status: 503 })
  }

  return NextResponse.json(
    { status: (data?.status as SubscriptionStatus | undefined) ?? null },
    {
      status: 200,
      headers: {
        // Polling depends on this being uncached at every layer.
        'Cache-Control': 'no-store',
      },
    },
  )
}
