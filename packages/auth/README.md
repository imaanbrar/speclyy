# @speclyy/auth

Shared Supabase auth layer and Next.js middleware helpers.

## Contents

- `src/server.ts` — `createServerSupabase()` for Server Components, Server Actions, Route Handlers.
- `src/browser.ts` — `createBrowserSupabase()` for Client Components.
- `src/middleware.ts` — `updateSession()` helper + composable gate functions (auth gate, onboarding gate, subscription gate). Callers pick which gates they need.

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

## Rules

- **Never import the service-role key here.** This package is safe for browser bundles in the `browser.ts` path. Service-role usage stays inside Route Handlers.
- **Env vars are read via `process.env` inside the package** for Supabase URL + anon key only (both are public). Everything else is passed in.
