# System Overview

> **Status:** stub — outline only. Fill in as diagrams and narrative land.

Top-level view of how Speclyy's pieces fit together. This doc is the entry point for anyone trying to understand the system before diving into component-specific docs.

## Scope

- System context: users, external services, Speclyy surfaces
- Container view: Next.js app, Astro marketing, Fly scraper, Inngest, Supabase (Postgres + Auth + Storage + Realtime), Stripe, Axiom, Claude API
- Key runtime flows (cross-linked to dedicated docs)

## Outline

### 1. Context diagram
*(diagrams/system-context.mmd)*

Actors: designer, admin, Stripe, vendor sites, Claude API.

### 2. Container diagram
*(diagrams/containers.mmd)*

Boxes + protocols between them. Call out trust boundaries.

### 3. Primary user flows
- Sign-in → project → add item (cache hit)
- Add item (cache miss → scrape → async completion)
- Subscribe / upgrade / cancel
- Admin bulk crawl

### 4. Data ownership
Which service owns which data, and what crosses boundaries.

### 5. Deployment topology
Short version — defer to [deployments.md](deployments.md).

### 6. Cross-references
- [application.md](application.md)
- [auth.md](auth.md)
- [database.md](database.md)
- [storage.md](storage.md)
- [scraper/README.md](scraper/README.md)
- [billing.md](billing.md)
- [security.md](security.md)
- [operations.md](operations.md)
- [deployments.md](deployments.md)
