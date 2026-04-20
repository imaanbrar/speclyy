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
