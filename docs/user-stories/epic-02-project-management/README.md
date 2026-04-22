# Epic 2 — Project Management

**Goal:** Designers create, organize, and manage multiple projects with free-form named groups that match how *they* think about a renovation — not a system-imposed taxonomy.

**Primary persona:** [Designer](../personas.md#designer-designer--primary)

## Stories (planned)

> Stories in this epic are not yet written. The table below is the planned decomposition — file paths and IDs are reserved.

| ID | Title | Priority | Status | Est |
|----|-------|----------|--------|-----|
| US-201 | Create project (name, optional client, optional address) | P0 | 🔲 draft | 2 |
| US-202 | View projects list with metadata (room count, item count, last modified) | P0 | 🔲 draft | 2 |
| US-203 | Add a group to a project | P0 | 🔲 draft | 2 |
| US-204 | Rename a group inline | P0 | 🔲 draft | 1 |
| US-205 | Reorder groups via drag (order persisted to PDF export) | P1 | 🔲 draft | 3 |
| US-206 | Delete a project (with confirmation) | P1 | 🔲 draft | 2 |

**Total estimate:** 12 points

## Depends on

- [Epic 1 — Authentication & Onboarding](../epic-01-auth-onboarding/README.md) — every action requires an authenticated, onboarded session.

## Unblocks

- **Epic 3 (Search), Epic 4 (URL Prefill), Epic 5 (Manual Entry)** — all "Add Item" flows attach an item to a group, which requires a project + group to exist first.
- **Epic 6 (Completeness)** — TBD/missing aggregations roll up at the group and project level.
- **Epic 7 (PDF Export)** — export operates on a project; group order is preserved.

## Source documents

- [`../../mvp-prd.md`](../../mvp-prd.md) — projects + grouping model
- [`../../screen-inventory.md`](../../screen-inventory.md) § 3.1 Projects List, § 3.2 New Project Modal, § 4.1 Project Overview, § 4.2 Group View
- [`../../user-flows.md`](../../user-flows.md) — Supporting Flow + Flow 4 (rename, reorder)

## Architecture references

- [ADR-0003 — Database engine: PostgreSQL](../../architecture/adr/0003-database-engine.md) — relational model fits Project → Group → Item hierarchy
- [ADR-0008 — ORM: Drizzle](../../architecture/adr/0008-orm.md)
- [`../../architecture/database.md`](../../architecture/database.md) — schema for projects, groups, items
- RLS: every project row is gated by `user_id = auth.uid()` per [ADR-0007](../../architecture/adr/0007-auth-data-model.md)

## Notes for implementers

- **Groups are free-form.** No enforced taxonomy — a designer can name a group "Plumbing Fixtures", "Master Ensuite", "Level 1 - Kitchen", or anything else. The PDF export preserves group names exactly as entered ([`screen-inventory.md`](../../screen-inventory.md) § 4 grouping note).
- **No "delete group" story listed.** Deleting a group removes its items too — the UX implications (confirmation, undo, item reassignment) need a small design discussion before being added as US-207.
