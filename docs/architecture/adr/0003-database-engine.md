# ADR-0003: Database engine — Postgres

- **Status:** Accepted
- **Date:** 2026-04-20

## Context

Speclyy's primary data is a product catalog and project workspace. The core data shape is:

- **Canonical hierarchy** — Brand → Collection → Product → Finish/Variant → SKU
- **Project workspace** — Project → Group → Item, where items reference the global product catalog or are project-local
- **Many-to-many relationships** — a product appears across many projects; a designer's personal library spans many items
- **Per-category variant fields** — plumbing has flow rate; paint has sheen/base; tile has size/pattern — schema flexibility is needed within an otherwise structured model
- **Strong consistency domains** — billing (trial state, subscription status, promo codes), auth (user identity), inventory governance (dedupe, promotion)
- **Aggregations** — "TBD count per group", "items missing SKU across project", "products per brand" — all read-heavy and reporting-shaped
- **Future needs** — semantic search, AI moodboard matching, designer analytics

We need to decide (a) whether the primary store is relational or NoSQL, and (b) which engine.

## Decision

Use a **relational database** as the primary store. Specifically, use **PostgreSQL 15+**.

## Rationale

### Why relational over NoSQL

**The data model is inherently relational.** Brand → Collection → Product → Finish → SKU is a hierarchy with referential integrity at every level. A document database would force us to either denormalize (duplicate brand/collection into every product document, drift over time) or maintain manual references without foreign-key guarantees. Neither is acceptable given that *trust in product data* is the product's north-star principle.

**Products are shared across projects, library, and future global inventory.** This is a many-to-many relationship. SQL join tables are trivial and correct. Document stores force you to maintain references by hand or duplicate records — both fail at the scale we expect within a year.

**Billing and gate decisions demand ACID.** Trial expiry, subscription state, promo-code redemption, and inventory promotion must be transactionally correct. Eventually-consistent stores risk granting access after payment lapse or double-promoting a product.

**Aggregations are everywhere in the UI.** Every group card shows "X items, Y TBD". Every project overview shows completion state. Every export preview shows missing-field counts. SQL `GROUP BY` handles these natively. NoSQL needs pre-computed counters (more code, more consistency bugs) or map/reduce pipelines (overkill).

**JSONB collapses the "flexible schema" argument for NoSQL.** The only genuine argument for NoSQL here was per-category variant fields. Postgres JSONB gives us schema-flexible columns *inside* relational rows — we get both structure and flexibility.

**Reporting and analytics are SQL-native.** Every BI tool, every analyst, every future data partner speaks SQL. Picking NoSQL would mean ETL-ing back out for any analysis.

### Where NoSQL would win (and doesn't apply)

- Internet-scale horizontal sharding (billions of docs) — not our scale, not projected.
- Genuinely schemaless data where every row is different — we have a mostly-structured model with JSONB handling the variance.
- Simple key-value access at massive throughput — not our access pattern.
- Append-only log/telemetry data — not our primary data.

### Why Postgres specifically

| Feature | Why it matters |
|---|---|
| **JSONB** | Per-category variant fields (flow rate, sheen, pattern) without schema explosion. |
| **`pg_trgm`** | Fuzzy search — "Kohl" matches "Kohler" — for the library search workflow. |
| **Full-text search (`tsvector`)** | Good-enough library search without a separate Elasticsearch/Meilisearch service. |
| **`pgvector`** | Future semantic product matching and AI moodboard grounding (post-MVP). |
| **`citext` / `unaccent`** | Case- and accent-insensitive brand/product name matching. |
| **Row-Level Security** | Data isolation between designers enforced at the DB layer, not just in application code. |
| **Partial + expression indexes** | `WHERE status = 'TBD'` is a frequent query pattern — partial indexes make it fast. |
| **Rich extension ecosystem** | Every niche need we've imagined already has an extension. |
| **Open-source, no vendor moat** | Migrate hosts via `pg_dump`/`pg_restore`. Portability is real. |
| **Universal tooling support** | Every ORM (Drizzle, Prisma), every host, every SaaS connector supports Postgres first-class. |

## Consequences

**Positive**
- One engine handles structured catalog data, flexible variant fields (JSONB), search (FTS + trigram), and future vector search — no polyglot persistence at MVP.
- Foreign-key and `CHECK` constraints enforce the "trust in data" principle at the engine level, not just the app.
- Row-Level Security lets us isolate tenant data in the database itself, reducing the surface for application-layer mistakes.
- Postgres skills transfer — every deployment target (Supabase, Neon, RDS, Aurora, Azure, self-hosted) is a viable migration path.

**Negative**
- Scaling writes past a single primary eventually requires partitioning or sharding — not an MVP concern, but a known future work item.
- Extension management becomes a dependency — we pin Postgres major versions to avoid extension breakage.
- Schema migrations are real work (versus schemaless "just write the doc") — we accept this tradeoff for the consistency guarantees.

## Alternatives considered

- **MongoDB / Firestore / DynamoDB (document)** — Rejected. Forces either denormalization of a naturally normalized model, or manual reference management without integrity guarantees. The one advantage (flexible schema) is subsumed by Postgres JSONB.
- **MySQL / MariaDB** — Would work. Rejected because we'd lose JSONB-with-indexing, `pg_trgm`, `pgvector`, and the RLS model we intend to use with Supabase. No compensating advantage.
- **Microsoft SQL Server** — Mature and familiar to the author. Rejected because it drags in licensing, Azure-centric hosting assumptions, and weaker open-source ecosystem alignment. Nothing in our feature set needs MSSQL.
- **SQLite (via Turso, LiteFS, etc.)** — Clever for edge-deployed read-heavy apps. Rejected because we need concurrent writes (multi-designer future), RLS, `pgvector`, and managed backups.
- **CockroachDB** — Postgres-wire distributed SQL. Rejected because horizontal-scale distributed SQL is overkill for MVP; performance and extension compatibility differ enough from native Postgres to be a risk.
- **Hybrid (Postgres + MongoDB for variants)** — Rejected. Two stores = two consistency models, two backup regimes, two query languages. JSONB makes this unnecessary.
