# @speclyy/moodboard

Standalone mood board app. Deploys to `moodboards.speclyy.com` as its own Vercel project.

Shares `@speclyy/auth`, `@speclyy/db`, and `@speclyy/design-system` with `apps/web` — a user signed in to `app.speclyy.com` is signed in here too, via the shared `.speclyy.com` auth cookie.

## Local dev

```bash
pnpm dev:moodboard   # runs on http://localhost:3001
```

Runs on port 3001 so `apps/web` (3000) and `apps/moodboard` can both run locally at once. Set `.env.local` to point at the dev Supabase project.

## Scope

This app owns only the `moodboards` / `moodboard_items` tables in the shared schema (see `packages/db`). Projects, groups, items, scraper UI — none of that ships here. Designers who want those features upgrade to `app.speclyy.com`.
