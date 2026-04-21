# Deployments & Environments

> **Status:** stub — outline only.

Environments, CI/CD, migration promotion, rollout/rollback, and config management across Vercel, Fly, and Supabase.

## Scope

Operational doc for how code and schema get from a laptop to production safely.

## Outline

### 1. Environments
- `local` — dev laptop
- `preview` — Vercel per-PR + Supabase branch (if used)
- `production`
- What's shared vs. isolated per env (DB, storage, Stripe mode, Axiom dataset)

### 2. Repo & branch strategy
- Monorepo layout (pnpm workspaces)
- Branching model (trunk-based? release branches?)
- PR requirements (checks, reviews)

### 3. CI
- What runs on PR (lint, typecheck, tests, build)
- What runs on main
- Required checks

### 4. Deployment targets
- **Vercel** — Next.js app + Astro marketing
  - Project wiring in the monorepo
  - Env var management
  - Preview deploys
- **Fly.io** — scraper
  - Image build, deploy command
  - Secrets
  - Regions / scaling
- **Supabase** — DB, Auth, Storage, Realtime
  - Project per env
  - Migrations (see below)

### 5. Migrations
- Source of truth: `supabase/migrations/`
- Promotion flow: local → preview → prod
- Who runs them, with what command
- Dangerous migrations (locking, backfills) — process
- Rollback strategy (forward fixes preferred)

### 6. Config & secrets
- Env var inventory (per env)
- Secret injection per platform
- Cross-ref [security.md](security.md)

### 7. Rollout & rollback
- Vercel instant rollback
- Fly rollback
- Supabase — no rollback for schema; forward fix
- Feature flags (if/when adopted)

### 8. Release coordination
- How we sync app ↔ migration ↔ scraper releases
- Breaking change protocol

### 9. Disaster scenarios
- Cross-ref [operations.md](operations.md) runbooks

## Cross-references
- [application.md](application.md) — Next.js app structure
- [marketing.md](marketing.md) — Astro deploy
- [scraper/README.md](scraper/README.md) — Fly host
- [database.md](database.md) — migrations
- [security.md](security.md)
- [operations.md](operations.md)
