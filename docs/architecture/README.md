# Architecture

Technical architecture for Speclyy — decisions, high-level design, and diagrams.

## Structure

```
docs/architecture/
├── README.md        — this file (overview + index)
├── adr/             — Architecture Decision Records (numbered, immutable once Accepted)
├── diagrams/        — system diagrams, sequence diagrams, data model (add as created)
└── *.md             — narrative architecture docs (add as written)
```

## What lives where

- **ADRs** capture a single decision: context, options, chosen path, tradeoffs. Immutable once **Accepted** — superseded by a new ADR when the decision changes. See [adr/README.md](adr/README.md) for the index and process.
- **Narrative docs** (e.g. `auth.md`, `database.md`, `scraper.md`) describe *how* a component works end-to-end — the current state, not a historical decision. These get updated in place as the system evolves.
- **Diagrams** live under `diagrams/`. Prefer Mermaid (renders in GitHub) or committed SVG/PNG with the source file alongside.

## Quick index

### Decisions (ADRs)
See [adr/README.md](adr/README.md).

### Narrative docs
- [application.md](application.md) — route groups, RSC vs Client Components, Server Actions, data fetching, env vars
- [auth.md](auth.md) — sign-in flow, session lifecycle, middleware gates, data model, RLS
- [database.md](database.md) — full schema, dual-client pattern, migrations, RLS policies, query patterns
- [storage.md](storage.md) — buckets, upload flows, image transforms, signed URLs, R2 migration path
- [scraper/README.md](scraper/README.md) — scraper overview and index
  - [scraper/on-demand.md](scraper/on-demand.md) — cache check, Inngest steps, Playwright stealth, Claude extraction, async + failure UX
  - [scraper/bulk-crawl.md](scraper/bulk-crawl.md) — admin-triggered brand crawls, URL discovery, daily batching, admin API
  - [scraper/performance.md](scraper/performance.md) — browser pool, pre-warm strategies, cache flywheel
  - [scraper/failure-tracking.md](scraper/failure-tracking.md) — failure taxonomy, schema, Axiom queries, feedback loop

### Diagrams
*(none yet — added as components are designed)*
