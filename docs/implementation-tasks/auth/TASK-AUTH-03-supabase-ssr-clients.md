---
id: TASK-AUTH-03
title: Supabase SSR client factories + generated DB types
group: auth
status: done
estimate: 2
dependencies: [TASK-AUTH-01, TASK-AUTH-02]
related_screens: []
related_adrs: [ADR-0006]
created: 2026-04-22
---

# TASK-AUTH-03 — Supabase SSR client factories

## Goal

Expose the three `@supabase/ssr` client factories — **browser**, **server**, **middleware** — from a single internal package so every future task imports from one place and never touches cookie plumbing directly. Plus a typed **service-role** helper that is physically separated from the browser bundle. This is the primitive that TASK-AUTH-04 / -05 / -07 / -08 all consume.

## Scope

**In scope**
- A package (e.g. `@speclyy/auth` or `apps/web/src/lib/supabase/`) exporting:
  - `createBrowserClient()` — for Client Components and browser-only code.
  - `createServerClient()` — for RSC and Server Actions (reads cookies from `next/headers`).
  - `createMiddlewareClient(request, response)` — the `get/setAll` cookie-rewriting variant used in `middleware.ts`.
  - `createServiceRoleClient()` — uses `SUPABASE_SECRET_KEY`. **Server-only**; importing from a client boundary must fail at build time.
- Typed with the Drizzle-generated types from TASK-AUTH-02 so `supabase.from('profiles').select()` is fully typed.
- A `server-only` import (via the `server-only` npm package) on the service-role module to guarantee client-bundle exclusion.
- Barrel `index.ts` with explicit exports — no `export *`.

**Out of scope**
- Any specific route / middleware / page — those are separate tasks.
- Refresh-token logic — `@supabase/ssr` handles it; we just wire the cookie adapter.

## Acceptance criteria

```gherkin
Scenario: Browser factory is safe in a Client Component
  Given a Client Component imports createBrowserClient
  When the app is built
  Then the build succeeds and the resulting bundle does NOT contain SUPABASE_SECRET_KEY

Scenario: Server factory reads cookies from next/headers
  Given an RSC that calls createServerClient().auth.getUser()
  When rendered with a valid session cookie
  Then user is non-null
  And calling it in a route without cookies returns user = null without throwing

Scenario: Middleware factory rewrites cookies on response
  Given createMiddlewareClient(request, response)
  When the client triggers a session refresh
  Then new Set-Cookie headers appear on the response

Scenario: Service-role client is server-only
  Given a Client Component tries to import createServiceRoleClient
  When the app is built
  Then the build fails with a "server-only" error
```

## Architecture references

- [ADR-0006 — Session strategy: cookie-based SSR via `@supabase/ssr`](../../architecture/adr/0006-session-strategy.md) — specifies the three-factory layout and why.
- [`../../architecture/auth.md`](../../architecture/auth.md) § "Components" — lists the factories and their roles.
- [Supabase SSR docs](https://supabase.com/docs/guides/auth/server-side/nextjs) — canonical cookie-adapter snippets.

## Implementation notes

- **Package location.** `packages/auth/` — decided. Per [ADR-0019](../../architecture/adr/0019-multi-app-architecture.md) every Speclyy app will need these factories, and extracting later is painful. If the scaffolded package isn't present yet, create it in this task.
- **Shape:**
  ```ts
  // browser.ts — "use client" safe
  export function createBrowserClient() { /* @supabase/ssr createBrowserClient */ }

  // server.ts — imports 'server-only'
  export function createServerClient() {
    const cookieStore = cookies() // from next/headers
    return createServerClientFromSSR(URL, ANON_KEY, { cookies: { getAll, setAll } })
  }

  // middleware.ts — takes (request, response) from NextRequest/NextResponse
  export function createMiddlewareClient(request, response) { /* … */ }

  // service-role.ts — imports 'server-only', uses SUPABASE_SECRET_KEY
  export function createServiceRoleClient() { /* … */ }
  ```
- **Types.** Import the Drizzle-generated `Database` type and pass it as the generic: `createServerClient<Database>(…)`. Every factory returns the typed `SupabaseClient<Database>`.
- **Env access.** Read env via a tiny typed accessor (e.g. `getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL')`) so a missing env fails fast and loudly instead of producing a cryptic Supabase error.
- **Cookie adapter (server + middleware).** Follow the Supabase Next.js App Router example exactly — `getAll` / `setAll` shape, not the deprecated `get/set/remove`.

## Review notes

- **Service-role isolation.** Grep the final bundle (`next build` output) for the service-role key. It must not appear. The `server-only` import should make this impossible, but a belt-and-braces grep in review is cheap.
- **No re-export of `@supabase/supabase-js`** from these factories — keeping the surface to just our four functions prevents call sites from instantiating raw clients and bypassing our cookie glue.
- **Don't cache client instances across requests.** Each request needs its own client because cookies are per-request. Reviewers: watch for top-level `const supabase = createServerClient()` — that is a bug.
- **Type-import vs value-import.** The `Database` type should be imported with `import type` so the generated types file never enters the server-only bundle unnecessarily.
- **Error on missing env** should include the key name but not the (missing) value, to avoid echoing a partially-set secret into logs.

## Test plan

- **Build check:** `pnpm -r build` succeeds. Inspect the client bundle to confirm service-role key absence (`rg` on `.next/static` output).
- **Unit:** mock `cookies()` and assert `createServerClient()` threads through `getAll/setAll` correctly.
- **Unit:** `createServiceRoleClient` throws or fails to compile when imported from a `"use client"` file (use a negative build test).
- **Manual:** in an RSC on a throwaway page, call `getUser()` and log the result to confirm typing and session reading work end-to-end.

## Open questions

- None.
