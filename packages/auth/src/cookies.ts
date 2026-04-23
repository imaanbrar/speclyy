/**
 * Shared cookie options for the `@supabase/ssr` clients.
 *
 * In production we scope session cookies to `.speclyy.com` so sibling apps at
 * `app.speclyy.com`, `<future-app>.speclyy.com`, etc. pick up the session
 * automatically (ADR-0019). Locally this must stay on `localhost` — setting a
 * Domain attribute there either breaks the cookie or at best narrows it so
 * `http://localhost:3000` can't read it back.
 *
 * The env gate is `NEXT_PUBLIC_COOKIE_DOMAIN`. Set it to `.speclyy.com` in
 * Production + Preview Vercel scopes. Leave it unset locally.
 */

export const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined

export const sharedCookieOptions = COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}
