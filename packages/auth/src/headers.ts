import { headers } from 'next/headers'

/**
 * Header set by `updateSession` middleware to forward the authenticated
 * user's ID to downstream Server Components, Server Actions, and Route
 * Handlers — anywhere `headers()` is callable.
 *
 * Trustworthy because middleware overwrites or deletes this header on every
 * request before the page sees it, so a client trying to spoof
 * `x-speclyy-user-id` gets stripped. Never read it from request paths that
 * skip middleware (none today, but worth knowing).
 *
 * Pages that only need the user ID (no email or other auth metadata) should
 * prefer `getUserIdFromHeaders()` over `createServerSupabase().auth.getUser()`
 * — saves a ~100ms round-trip per request because Supabase's `getUser`
 * always re-validates the JWT against `/auth/v1/user`.
 *
 * NOTE: the constant is duplicated in `packages/auth/src/middleware.ts`
 * (Edge runtime — can't import `next/headers`). Keep both in sync.
 */
export const USER_ID_HEADER = 'x-speclyy-user-id'

/**
 * Returns the authenticated user's ID as set by middleware, or `null` for
 * anonymous requests. Cheap header read — no network, no JWT decode.
 */
export async function getUserIdFromHeaders(): Promise<string | null> {
  const h = await headers()
  return h.get(USER_ID_HEADER)
}
