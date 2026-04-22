# Epic 3 — Product Search & Discovery

**Goal:** When the product is already in Speclyy's curated library, a designer can find it and add it to their project in under 30 seconds — no URL paste, no manual typing.

**Primary persona:** [Designer](../personas.md#designer-designer--primary)

## Stories (planned)

> Stories in this epic are not yet written. The table below is the planned decomposition — file paths and IDs are reserved.

| ID | Title | Priority | Status | Est |
|----|-------|----------|--------|-----|
| US-301 | Search global library by keyword | P0 | 🔲 draft | 3 |
| US-302 | Filter search results by type (plumbing, paint) | P1 | 🔲 draft | 2 |
| US-303 | Add a search result to the current group | P0 | 🔲 draft | 2 |
| US-304 | Search empty state with manual / URL paste fallback CTAs | P0 | 🔲 draft | 1 |
| US-305 | Pre-select the originating group when adding from search | P1 | 🔲 draft | 1 |

**Total estimate:** 9 points

## Depends on

- [Epic 1](../epic-01-auth-onboarding/README.md) — authenticated session.
- [Epic 2](../epic-02-project-management/README.md) — a project + group must exist to add into.

## Unblocks

- Nothing functional — Epic 3 is one of three parallel "Add Item" entry points (alongside Epics 4 and 5).

## Source documents

- [`../../mvp-prd.md`](../../mvp-prd.md) — global library scope (Delta, Brizo, Kohler for plumbing; Sherwin-Williams, Benjamin Moore for paint)
- [`../../mvp-decisions.md`](../../mvp-decisions.md) § 3 (Seed Data Scope — demo-ready slice first)
- [`../../screen-inventory.md`](../../screen-inventory.md) § 4.3 Add Item — Search Library
- [`../../user-flows.md`](../../user-flows.md) — Flow 1 (search → add)

## Architecture references

- [ADR-0003 — Database engine: PostgreSQL](../../architecture/adr/0003-database-engine.md) — pgvector available if we later upgrade keyword search to semantic
- [`../../architecture/database.md`](../../architecture/database.md) — global library tables (Brand → Collection → Product → Finish → SKU)

## Notes for implementers

- **Success criterion** ([`user-flows.md`](../../user-flows.md) Flow 1): "Product added in under 30 seconds from opening the project." Use this as the acceptance bar for performance.
- **Filter chips are search-only** — they do not impose a taxonomy on the designer's groups ([`screen-inventory.md`](../../screen-inventory.md) § 4.3).
- **MVP seed data is intentionally narrow** — the search must gracefully say "Not finding it? Add manually / paste URL" when empty (US-304).
- **Multiple finish options** — when a search result has multiple finishes, prompt the designer to pick one before adding, OR add as TBD with finish flagged for later. Edge case noted in [`user-flows.md`](../../user-flows.md) Flow 1.
