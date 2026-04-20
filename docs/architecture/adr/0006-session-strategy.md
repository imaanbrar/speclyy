# ADR-0006: Session strategy — Cookie-based SSR via `@supabase/ssr`

- **Status:** Accepted
- **Date:** 2026-04-20

## Context

Next.js App Router renders data on the server via React Server Components (RSC). Server Components, middleware, Server Actions, and Route Handlers all run without access to browser storage (`localStorage`, `sessionStorage`).

We need a session model that is readable by:
- Middleware (for route gates)
- Server Components (for server-side data fetching)
- Server Actions and Route Handlers (for mutations)
- Client Components (for interactive UI)

…and is secure by default.

Three patterns were evaluated:
1. Client-side JWT in `localStorage`
2. Server-side session ID cookie with server session store (Redis/DB)
3. Cookie-based JWT

## Decision

Use **cookie-based JWT sessions** via the official `@supabase/ssr` package. Supabase stores the access token (short-lived JWT) and refresh token as **`httpOnly`, `Secure`, `SameSite=Lax`** cookies. Middleware handles silent token refresh on every request.

Three client factories from the same library, one per runtime:

- `createBrowserClient()` — Client Components; reads cookies via `document.cookie`.
- `createServerClient()` — RSC, Server Actions, Route Handlers; reads cookies via `next/headers`.
- `createServerClient()` in `middleware.ts` — reads request cookies, rewrites response cookies on token refresh.

## Rationale

**RSC compatibility is non-negotiable.** Client-side JWT in `localStorage` cannot be read by the server during SSR. Picking that pattern would force every authenticated page back to client-side data fetching with loading spinners — forfeiting the RSC benefit that justified Next.js in ADR-0001.

**Security defaults are strictly safer than localStorage.**
- `httpOnly` — injected JavaScript (XSS) cannot read the cookie, so a successful XSS does not immediately leak the session token.
- `Secure` — cookie only transmitted over HTTPS.
- `SameSite=Lax` — cookie not sent on cross-site non-GET requests, blocking the classic CSRF vector.

The historical "cookies are CSRF-vulnerable" concern is fully mitigated by `SameSite=Lax`, which is the modern default and what `@supabase/ssr` sets.

**Transparent refresh.** `supabase.auth.getUser()` in middleware rotates expired access tokens silently using the refresh token. The response carries new `Set-Cookie` headers back to the browser. Users never see a surprise logout.

**Stateless on the server.** Unlike session-ID cookies with a server-side store, cookie-based JWT needs no shared session database to scale horizontally — matches Vercel's serverless execution model.

**Library maturity.** `@supabase/ssr` is the officially supported package for Next.js App Router, actively maintained, with documented worked examples.

## Consequences

**Positive**
- Auth works everywhere — middleware, RSC, Server Actions, Client Components — with no custom adapters.
- XSS-safe by default (`httpOnly`).
- CSRF-safe by default (`SameSite=Lax`).
- Silent session refresh — no sudden logouts from access-token expiry.
- Stateless — no Redis or session table to maintain.

**Negative**
- Three client factories to remember (browser / server / middleware). One-time conceptual ramp.
- Middleware runs on every dynamic request — one JWT verify (sub-millisecond) and occasional refresh-token round-trip. Acceptable overhead.
- Debugging requires reading cookies in dev tools rather than `localStorage`. Minor.
- Cookie flags + domain/path rules matter — a misconfigured `SameSite` or `Secure` breaks auth silently. Worth a pre-launch checklist.

## Alternatives considered

- **Client-side JWT in `localStorage`** — Familiar from SPAs. Rejected because: (a) incompatible with RSC — server cannot read `localStorage`; (b) vulnerable to XSS token exfiltration; (c) we'd write our own token refresh logic.
- **Server-side session ID cookie with Redis/DB session store** — Stateful classic. Rejected because: requires a session store we'd maintain; adds a round-trip to the store on every request; offers no security advantage once JWT cookies are `httpOnly`; unnecessary complexity for a stateless Next.js app.
- **Hybrid: `localStorage` for client-only + cookies for SSR** — Rejected. Two stores to keep synchronized, two failure modes, no security benefit, unnecessary complexity.

## References

- [Supabase Auth with Next.js App Router](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [MDN — `Set-Cookie` attributes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
- ADR-0001 Application framework (commits us to RSC)
- ADR-0005 Auth provider (commits us to Supabase Auth)
