# @speclyy/auth

Shared Supabase auth layer and cross-app Next.js middleware.

Every Next.js app in the monorepo (`apps/web`, `apps/moodboard`, …) imports from here so a user who logs in on one app is logged in on the others.

## Contents

- `src/server.ts` — `createServerSupabase()` for Server Components, Server Actions, Route Handlers.
- `src/browser.ts` — `createBrowserSupabase()` for Client Components.
- `src/middleware.ts` — `updateSession()` helper + composable gate functions (auth gate, onboarding gate, subscription gate). Each app picks which gates it needs.

## Cookie strategy

Both apps are served from subdomains of `speclyy.com` (`app.speclyy.com`, `moodboards.speclyy.com`). The Supabase auth cookie is set on `.speclyy.com` so a session on one subdomain is honoured on the other. See [docs/architecture/auth.md](../../docs/architecture/auth.md).

## Usage

```ts
// apps/web/src/middleware.ts
import { updateSession, requireAuth, requireOnboarding, requireActiveSubscription } from '@speclyy/auth/middleware'

export async function middleware(req: NextRequest) {
  const res = await updateSession(req)
  return requireActiveSubscription(req, res)
    ?? requireOnboarding(req, res)
    ?? requireAuth(req, res)
    ?? res
}
```

```ts
// apps/moodboard/src/middleware.ts — lighter gate chain: auth only
import { updateSession, requireAuth } from '@speclyy/auth/middleware'

export async function middleware(req: NextRequest) {
  const res = await updateSession(req)
  return requireAuth(req, res) ?? res
}
```

## Rules

- **Never import the service-role key here.** This package is safe for browser bundles in the `browser.ts` path. Service-role usage stays inside Route Handlers inside each app.
- **Env vars are read via `process.env` inside the package** for Supabase URL + anon key only (both are public). Everything else is passed in.
