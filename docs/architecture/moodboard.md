# Mood Board App — Architecture

The standalone mood board app (`apps/moodboard`, deployed at `moodboards.speclyy.com`). A separate Vercel deployment from the designer app, with a narrower scope and its own pricing surface.

For the *why* — why mood boards are a separate app rather than a `/moodboards` route inside the designer app — see [ADR-0016](adr/0016-shared-packages-and-moodboard-app.md).

---

## Scope

The mood board app owns:

- `moodboards` — top-level boards owned by a user.
- `moodboard_items` — images / products placed on a board (canvas position, z-index, notes).

It does **not** own projects, groups, specs, scrape cache, or billing. Users who want those features sign in to `app.speclyy.com` (same account, same session — see "Cross-domain auth" below).

Boards created in the standalone app have `project_id = NULL`. If the same user later upgrades to the designer app, those boards are visible there too and can be attached to a project by setting `project_id`.

---

## Routes

```
app/
├── (auth)/
│   ├── sign-in/page.tsx          → /sign-in
│   └── auth/callback/route.ts    → /auth/callback
└── (app)/
    ├── layout.tsx                 → app shell (minimal — no sidebar)
    └── moodboards/
        ├── page.tsx              → /moodboards       (list)
        └── [id]/
            └── page.tsx          → /moodboards/[id]  (canvas editor)
```

No `(onboarding)` or `(billing)` route groups. The app is intentionally thin: sign in → list of boards → edit a board.

---

## Middleware

One gate: auth. No onboarding or subscription gate.

```ts
// apps/moodboard/src/middleware.ts
import { updateSession, requireAuth } from '@speclyy/auth/middleware'

export async function middleware(request: NextRequest) {
  const response = await updateSession(request)
  return requireAuth(request, response) ?? response
}
```

If a paid tier lands for boards, it composes in the same `requireActiveSubscription` gate that `apps/web` uses, from `@speclyy/auth/middleware` — no per-app auth code.

---

## Cross-domain auth

Both apps sit under `speclyy.com`. The Supabase auth cookie is set with `Domain=.speclyy.com` so a session on either subdomain is accepted by the other. A user who signs up at `moodboards.speclyy.com` and later visits `app.speclyy.com` is already signed in.

The `NEXT_PUBLIC_COOKIE_DOMAIN` env var controls this (set to `.speclyy.com` in prod, empty in local dev).

Implementation lives in `@speclyy/auth` so both apps use identical cookie config.

---

## Data boundary

| Table | Read | Write |
|---|---|---|
| `moodboards` | ✅ | ✅ |
| `moodboard_items` | ✅ | ✅ |
| `profiles` (own row) | ✅ | ✅ |
| `scrape_cache` (read-only) | ✅ | — (no scraper trigger from this app) |
| `global_products` (read-only) | ✅ | — |
| `projects`, `project_groups`, `project_items` | ❌ | ❌ |
| `subscriptions` | ✅ (read own) | ❌ |

RLS enforces these boundaries — the app doesn't need to self-police. The standalone mood board app simply never queries the project tables.

---

## Build & deploy

- **Root directory:** `apps/moodboard` (Vercel project `speclyy-moodboard`).
- **Port (local):** `3001` — `apps/web` runs on `3000`, so both can run concurrently via `pnpm dev:web` and `pnpm dev:moodboard`.
- **Shared packages:** `@speclyy/auth`, `@speclyy/db`, `@speclyy/design-system` declared in `transpilePackages` in `next.config.mjs`.

A change to `packages/db` or `packages/auth` rebuilds both `speclyy-web` and `speclyy-moodboard` — Vercel detects workspace dependencies via pnpm's graph.

---

## References

- [ADR-0016](adr/0016-shared-packages-and-moodboard-app.md) — decision record for the split
- [application.md](application.md) — shared Next.js patterns
- [auth.md](auth.md) — sign-in flow, RLS, cookie strategy
- [deployments.md](deployments.md) — Vercel project config
