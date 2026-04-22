# Epic 5 — Manual Entry & Item Form

**Goal:** A designer can add a product without a URL — from memory, a showroom visit, a paper quote, a phone photo — and edit any item later. The shared item form is the workhorse of the entire app.

**Primary persona:** [Designer](../personas.md#designer-designer--primary)

## Stories (planned)

> Stories in this epic are not yet written. The table below is the planned decomposition — file paths and IDs are reserved.

| ID | Title | Priority | Status | Est |
|----|-------|----------|--------|-----|
| US-501 | Open a blank manual-entry form | P0 | 🔲 draft | 1 |
| US-502 | Save an item with name only (no other fields required) | P0 | 🔲 draft | 2 |
| US-503 | Edit an existing item (toggle view ↔ edit mode) | P0 | 🔲 draft | 2 |
| US-504 | Delete an item (with confirmation) | P0 | 🔲 draft | 1 |
| US-505 | Upload a product image (when no auto-fetched image exists) | P1 | 🔲 draft | 3 |
| US-506 | Assign or move an item to a group | P0 | 🔲 draft | 2 |
| US-507 | Toggle item status (Complete / TBD) | P0 | 🔲 draft | 1 |

**Total estimate:** 12 points

## Depends on

- [Epic 1](../epic-01-auth-onboarding/README.md) — authenticated session.
- [Epic 2](../epic-02-project-management/README.md) — project + group exist.

## Unblocks

- [Epic 4](../epic-04-url-prefill-scraper/README.md) — the prefilled form rendered on scrape success **is** this same form, populated.
- [Epic 6](../epic-06-completeness-status/README.md) — status (Complete / TBD) on items drives all aggregations.
- [Epic 7](../epic-07-pdf-export/README.md) — every field of every item is what gets rendered into the PDF.

## Source documents

- [`../../mvp-prd.md`](../../mvp-prd.md) — Add products (manual)
- [`../../screen-inventory.md`](../../screen-inventory.md) § 4.5 Add Item — Manual Entry, § 4.6 Item Form (shared), § 4.7 Item Detail / Edit
- [`../../user-flows.md`](../../user-flows.md) — Flow 3 (manual save), Flow 4 (edit)

## Architecture references

- [ADR-0008 — ORM: Drizzle](../../architecture/adr/0008-orm.md)
- [ADR-0009 — Storage: Supabase Storage](../../architecture/adr/0009-storage.md) — image uploads
- [`../../architecture/database.md`](../../architecture/database.md) — `items` schema (14 fields per [`screen-inventory.md`](../../screen-inventory.md) § 4.6)
- [`../../architecture/storage.md`](../../architecture/storage.md) — image upload + transform pipeline

## Notes for implementers

- **Key principle** ([`user-flows.md`](../../user-flows.md) Flow 3): "No field is blocking. A name alone is enough to save." The form's only required field is `product_name`.
- **Form is shared across three entry points**: Search (Epic 3), URL Prefill (Epic 4), and Manual Entry (Epic 5). Implement once; render with three initial-state variants.
- **Item status** ([`screen-inventory.md`](../../screen-inventory.md) § 4.6): two values — `Complete` and `TBD`. The "Missing" badge in the group view is a derived UI state when a status-`TBD` item also has unfilled "important" fields — see Epic 6.
- **14 fields total** per item: product_name (required), brand, collection, finish, sku, colour, material, dimensions (W×H×D inches), product_url, image, notes, group_id, status, plus internal fields (id, project_id, created_at, etc.).
