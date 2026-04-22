# Epic 4 — URL Prefill / Scraper UX

**Goal:** A designer pastes any vendor product URL, and Speclyy extracts the structured fields automatically — turning copy-paste-from-vendor-page-by-hand into a single action. This epic is the **core differentiator** of the product.

**Primary persona:** [Designer](../personas.md#designer-designer--primary)

## Stories (planned)

> Stories in this epic are not yet written. The table below is the planned decomposition — file paths and IDs are reserved.

| ID | Title | Priority | Status | Est |
|----|-------|----------|--------|-----|
| US-401 | Paste a URL and trigger a scrape | P0 | 🔲 draft | 3 |
| US-402 | Show loading state while scraping (~10–60s) | P0 | 🔲 draft | 2 |
| US-403 | Render prefilled item form on scrape success | P0 | 🔲 draft | 3 |
| US-404 | Fall back to blank manual form when scrape fails | P0 | 🔲 draft | 2 |
| US-405 | Handle partial scrape — flag missing fields as TBD | P0 | 🔲 draft | 2 |
| US-406 | Persist source URL on the item even when scrape fails | P1 | 🔲 draft | 1 |

**Total estimate:** 13 points

## Depends on

- [Epic 1](../epic-01-auth-onboarding/README.md) — authenticated session.
- [Epic 2](../epic-02-project-management/README.md) — project + group exist.
- [Epic 5](../epic-05-manual-entry-item-form/README.md) — the rendered form (US-403, US-404) reuses the shared item form from Epic 5.

## Unblocks

- **Epic 6 (Completeness)** — partial scrapes drive the TBD count rollups.

## Source documents

- [`../../mvp-prd.md`](../../mvp-prd.md) § "URL → spec extraction"
- [`../../mvp-decisions.md`](../../mvp-decisions.md) § 2 (URL Paste Behaviour — best-effort prefill with fallback)
- [`../../screen-inventory.md`](../../screen-inventory.md) § 4.4 Add Item — URL Paste, § 4.6 Item Form
- [`../../user-flows.md`](../../user-flows.md) — Flow 2 (success + fallback + partial)

## Architecture references

- [ADR-0010 — Scraper host: Fly.io persistent container](../../architecture/adr/0010-scraper-host.md)
- [ADR-0011 — Job queue: Inngest](../../architecture/adr/0011-job-queue.md)
- [ADR-0012 — Extraction strategy: Claude + DOM-pruned HTML + screenshot](../../architecture/adr/0012-extraction-strategy.md)
- [ADR-0014 — Log store: Axiom](../../architecture/adr/0014-log-store.md)
- [`../../architecture/scraper/README.md`](../../architecture/scraper/README.md), [`on-demand.md`](../../architecture/scraper/on-demand.md), [`failure-tracking.md`](../../architecture/scraper/failure-tracking.md), [`performance.md`](../../architecture/scraper/performance.md)

## Notes for implementers

- **Cache hit vs cache miss** ([`scraper/on-demand.md`](../../architecture/scraper/on-demand.md)):
  - Cache hit (~100ms): synchronous Server Action returns extracted data immediately.
  - Cache miss (10–60s): insert pending row, emit Inngest event, push result via Supabase Realtime when scraper finishes. UX must handle both flows transparently.
- **Image re-hosting**: vendor images are always copied to Supabase Storage on success ([ADR-0009](../../architecture/adr/0009-storage.md)). Item rows reference the Speclyy CDN URL, not the vendor URL — guarantees the image survives if the vendor deletes it.
- **Success criterion** ([`user-flows.md`](../../user-flows.md) Flow 2): "Product captured and saved in under 2 minutes, including any manual corrections." Loading state must communicate progress credibly.

## Admin / curator ops procedures (MVP — no UI)

Per [`personas.md`](../personas.md#admin--curator-admin--internal-speclyy-team), MVP curation happens via service-role queries, not a UI. Captured here so future stories can reference the existing procedure rather than reinvent it.

| Task | Procedure | Reference |
|------|-----------|-----------|
| Trigger a bulk crawl for a brand | `POST /api/admin/crawl` with shared-secret header | [ADR-0013 — Bulk crawl](../../architecture/adr/0013-bulk-crawl.md) |
| Inspect failed scrapes | APL query in Axiom dashboard, filter `event="scrape_failed"` | [ADR-0014 — Log store](../../architecture/adr/0014-log-store.md), [`scraper/failure-tracking.md`](../../architecture/scraper/failure-tracking.md) |
| Promote a scraped product into the global library | Service-role Drizzle insert into `products` from `scrape_cache` | [`../../architecture/database.md`](../../architecture/database.md) |
| Invalidate a stale scrape cache entry | Service-role Drizzle delete from `scrape_cache(url_hash)` | [`scraper/on-demand.md`](../../architecture/scraper/on-demand.md) |

The first admin UI ships in MVP+1 (see [`../../roadmap.md`](../../roadmap.md) — "Global product library approval UI"). When that lands, the procedures above will become user stories under a new `epic-10-admin-curation/` folder.
