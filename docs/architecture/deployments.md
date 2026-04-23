# Deployments & Environments

Environments, CI/CD, migration promotion, rollout/rollback, and secrets management across Vercel, Fly.io, and Supabase.

---

## Environments

| Environment | Purpose | Trigger |
|---|---|---|
| `local` | Developer laptop | Manual `pnpm dev` |
| `preview` | Per-PR preview | Push to any non-main branch |
| `production` | Live app | Merge to `main` |

### What's isolated per environment

| Resource | Local | Preview | Production |
|---|---|---|---|
| Supabase project | Local or shared dev project | Shared dev project | Dedicated prod project |
| Stripe mode | Test mode (`sk_test_...`) | Test mode | Live mode (`sk_live_...`) |
| Axiom dataset | `speclyy-dev` | `speclyy-dev` | `speclyy-prod` |
| Inngest | Dev server (`inngest dev`) | Inngest cloud (dev env) | Inngest cloud (prod env) |
| Fly.io scraper | Local docker or `fly deploy --env staging` | Shared dev scraper | Prod scraper |

> **No per-PR Supabase branch yet.** Preview deployments share the dev Supabase project. This means migrations must not be applied to dev until they're ready for all active preview deploys. Supabase branching is planned for when the team is > 2.

---

## Monorepo structure

```
speclyy/
├── apps/
│   ├── web/          → Next.js app (app.speclyy.com)
│   └── marketing/    → Astro site (speclyy.com)
├── packages/
│   ├── design-system/  → shared UI (tokens, components, Tailwind preset)
│   ├── db/             → shared Drizzle schema + Postgres client
│   └── auth/           → shared Supabase clients + Next.js middleware
└── pnpm-workspace.yaml
```

Vercel detects which app changed on push and only rebuilds the affected project. Two separate Vercel projects:
- `speclyy-web` → `apps/web/`
- `speclyy-marketing` → `apps/marketing/`

**Shared packages are not deployed.** They're consumed via `workspace:*` and bundled into each app at build time. A change to `packages/db` or `packages/auth` triggers a rebuild of every app that imports them — Vercel's monorepo detection handles this via package graph traversal.

---

## Branch strategy

Trunk-based development:
- `main` is always deployable.
- Feature work happens on short-lived branches (`feat/`, `fix/`, `chore/`).
- PRs require at least one review and passing CI before merge.
- No release branches — deploy from `main` directly.

---

## CI

GitHub Actions runs on every PR and push to `main`.

### PR checks

```yaml
# .github/workflows/ci.yml (planned)
jobs:
  lint:
    - pnpm lint          # ESLint across all apps
  typecheck:
    - pnpm typecheck     # tsc --noEmit
  test:
    - pnpm test          # Vitest unit tests
  build:
    - pnpm build         # next build + astro build (smoke test)
```

All checks must pass before merge. No required integration tests in CI yet — Playwright E2E runs are manual pre-release.

### Post-merge (main)

Vercel deploys automatically on merge to `main`. No separate CD pipeline — Vercel is the CD layer.

---

## Deployment targets

### Vercel — Next.js app

- **Project:** `speclyy-web`
- **Root directory:** `apps/web`
- **Build command:** `pnpm build`
- **Deploy:** automatic on push to `main` (production) or any branch (preview)
- **Env vars:** set in Vercel dashboard, scoped to production / preview / development
- **Rollback:** Vercel dashboard → Deployments → Instant Rollback (no redeploy needed)

### Vercel — Astro marketing site

- **Project:** `speclyy-marketing`
- **Root directory:** `apps/marketing`
- **Build command:** `pnpm build`
- **Output:** static (`@astrojs/vercel/static`)
- **Deploy:** automatic on push to `main`
- **Rollback:** same as above

### Fly.io — Scraper

- **App name:** `speclyy-scraper`
- **Deploy command:** `fly deploy` (run from `apps/scraper/` or root with `-c fly.toml`)
- **Config:** `fly.toml` in the scraper app directory
- **Secrets:** managed via `fly secrets set KEY=value` — never committed
- **Rollback:** `fly releases list` → `fly deploy --image <previous-image-ref>`
- **Scaling:** `auto_stop_machines = false` — one persistent machine; add machines for burst capacity

Scraper deploys are **not** automatic — they require a manual `fly deploy`. This is intentional: the scraper runs long-lived jobs and a rolling restart during active scrapes can cause orphaned Playwright sessions.

### Supabase — Postgres + Auth + Storage + Realtime

- **Projects:** `speclyy-dev` (dev/preview), `speclyy-prod` (production)
- **Migrations:** `supabase/migrations/` in the repo root
- **No automated migration on deploy** — see migration promotion below

---

## Migration promotion

> **Pre-launch status.** No Supabase project is provisioned yet — the first migration to land is the *initial* schema (auth tables, subscriptions, `processed_webhook_events`, per-app tables). There is no live data, no backfill risk, and no "dangerous migration" ceremony to perform for the initial bring-up. The flow below applies once we're live; until then, treat schema PRs as regular feature PRs.

Migrations are the highest-risk deploy step once production data exists. All migrations follow this flow:

```
1. Write migration in supabase/migrations/<timestamp>_description.sql
2. Test locally: supabase db push (against local Supabase)
3. Review in PR — require explicit migration review comment
4. After PR merge: apply to dev: supabase db push --db-url $DEV_DB_URL
5. Smoke test on preview environment
6. Apply to prod: supabase db push --db-url $PROD_DB_URL
   (done manually, never automated)
```

### Dangerous migration protocol

Migrations that lock tables or require backfills (e.g. adding a NOT NULL column to a large table, renaming a column) must:

1. Be split: first add the nullable column + backfill, then add the constraint in a second migration.
2. Be run during low-traffic hours.
3. Have a rollback plan documented in the PR description (usually a forward-fix migration, not a true rollback).
4. Be announced in Slack before running on prod.

### Rollback strategy

Supabase does not support schema rollback. The strategy is:
- **Forward fix** — write a new migration that reverts the change.
- **PITR restore** — for catastrophic data loss only; see [operations.md](operations.md).

---

## Config & secrets management

### Env var inventory

| Variable | Vercel scope | Fly scope | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | All | — | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | — | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Production + Preview | — | Server-only |
| `DATABASE_URL` | Production + Preview | — | Direct Postgres connection |
| `DATABASE_URL_POOLED` | Production + Preview | — | PgBouncer |
| `STRIPE_SECRET_KEY` | Production + Preview | — | `sk_live_` prod, `sk_test_` preview |
| `STRIPE_WEBHOOK_SECRET` | Production + Preview | — | Different secret per env |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | Production + Preview | — | $37/mo price ID; different per env |
| `STRIPE_PRICE_ID_PRO_ANNUAL` | Production + Preview | — | $29/mo billed annually price ID; different per env |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | All | — | Public |
| `INNGEST_EVENT_KEY` | Production + Preview | — | |
| `INNGEST_SIGNING_KEY` | Production + Preview | — | |
| `ADMIN_SECRET` | Production + Preview | — | Shared secret for admin APIs |
| `NEXT_PUBLIC_APP_URL` | All | — | `https://app.speclyy.com` prod |
| `ANTHROPIC_API_KEY` | — | Fly secret | Scraper only |

### Secret injection

- **Vercel:** set via dashboard or `vercel env add`. Never in `.env` files committed to git.
- **Fly:** set via `fly secrets set KEY=value`. Listed (not revealed) via `fly secrets list`.
- **Local:** `.env.local` — gitignored, never committed.

For environment parity, local `.env.local` should use Stripe test-mode keys and the dev Supabase project credentials.

---

## Rollout & rollback

### Vercel (Next.js + Astro)

- Zero-downtime deploy: Vercel routes traffic to the new deployment atomically.
- Rollback: dashboard → Deployments → select previous → **Instant Rollback** (no rebuild, < 30s).

### Fly.io (Scraper)

- Deploy performs a rolling restart. In-progress scrape jobs continue to completion on old machines; new jobs land on new machines.
- Rollback: `fly releases list` to find the previous release → `fly deploy --image <ref>`.

### Supabase schema

- No rollback. Forward-fix migration only.
- If a bad migration causes downtime: PITR restore to a point before the migration, then re-apply corrected migration. This is the last resort — coordinate with Supabase support.

---

## Release coordination

When a deploy involves a coordinated app + migration + scraper change:

1. Apply the migration to prod first (if additive / backward-compatible).
2. Deploy the scraper (if scraper schema changes are involved).
3. Deploy the Next.js app.
4. Verify in production (smoke test key flows).
5. If anything fails: rollback app first (Vercel instant rollback), then assess migration state.

Breaking schema changes (rename/drop) require a two-phase deploy:
- **Phase 1:** deploy app code that handles both old and new schema.
- **Phase 2:** apply schema change.
- **Phase 3:** remove the compatibility shim from app code.

---

## References

- [application.md](application.md) — Next.js app structure, env vars
- [marketing.md](marketing.md) — Astro deploy, Vercel monorepo setup
- [scraper/README.md](scraper/README.md) — Fly.io host details
- [database.md](database.md) — migrations, schema
- [security.md](security.md) — secrets handling, no client-bundle exposure
- [operations.md](operations.md) — rollback runbooks, incident response
