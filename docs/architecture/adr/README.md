# Architecture Decision Records

Decisions about Speclyy's technical architecture. Each ADR captures context, the choice made, and its consequences so a future maintainer (or future us) can understand *why*, not just *what*.

## Format

[MADR](https://adr.github.io/madr/)-lite. Filenames are `NNNN-short-slug.md`.

Statuses: **Proposed** · **Accepted** · **Superseded by ADR-XXXX** · **Deprecated**.

## Process

1. Raise a decision that has non-obvious tradeoffs.
2. Draft as **Proposed** with context + options + recommendation.
3. Discuss. Flip to **Accepted** once locked.
4. Supersede (don't edit) when a decision changes — keep the history.

## Index

| # | Title | Status |
|---|-------|--------|
| [0001](0001-application-framework.md) | Application framework — Next.js | Accepted |
| [0002](0002-hosting-platform.md) | Hosting platform — Vercel | Accepted |
| [0003](0003-database-engine.md) | Database engine — Postgres | Accepted |
| [0004](0004-postgres-host.md) | Postgres host — Supabase | Accepted |
| [0005](0005-auth-provider.md) | Auth provider — Supabase Auth | Accepted |
| [0006](0006-session-strategy.md) | Session strategy — cookie-based SSR via `@supabase/ssr` | Accepted |
| [0007](0007-auth-data-model.md) | Auth data model and middleware gates | Accepted (data-model section superseded by [0016](0016-onboarding-data-model-revision.md); gate chain still current) |
| [0008](0008-orm.md) | ORM — Drizzle | Accepted |
| [0009](0009-storage.md) | Object storage — Supabase Storage (migrate to R2 at $50/mo overage) | Accepted |
| [0010](0010-scraper-host.md) | Scraper host — Fly.io | Accepted |
| [0011](0011-job-queue.md) | Job queue — Inngest | Accepted |
| [0012](0012-extraction-strategy.md) | Extraction strategy — Claude API (Opus) | Accepted |
| [0013](0013-bulk-crawl.md) | Bulk crawl design | Accepted |
| [0014](0014-log-store.md) | Log store — Axiom | Accepted |
| [0015](0015-marketing-site.md) | Marketing site — Astro in monorepo, deployed on Vercel | Accepted |
| [0016](0016-onboarding-data-model-revision.md) | Onboarding data model revision — studios entity + free-text market | Accepted |
| [0017](0017-subscription-ownership.md) | Subscription ownership — per-user, not per-studio | Accepted |
| [0018](0018-payment-surface.md) | Payment surface — embedded Stripe Elements | Accepted |
