# Epic 6 — Completeness & Status Tracking

**Goal:** A designer can see at a glance — across an entire project — which items still need work, without having to open every group or remember what's missing. Completeness is visible at every level: project card, group card, item row, item detail, export preview.

**Primary persona:** [Designer](../personas.md#designer-designer--primary)

## Stories (planned)

> Stories in this epic are not yet written. The table below is the planned decomposition — file paths and IDs are reserved.

| ID | Title | Priority | Status | Est |
|----|-------|----------|--------|-----|
| US-601 | Show TBD count per group on the project overview cards | P0 | 🔲 draft | 2 |
| US-602 | Display item status badge (Complete / TBD / Missing) in group view | P0 | 🔲 draft | 2 |
| US-603 | Highlight TBD / unfilled fields in item detail view | P1 | 🔲 draft | 2 |
| US-604 | Show non-blocking warnings on the export preview ("X items missing SKU") | P0 | 🔲 draft | 2 |
| US-605 | Auto-derive Missing badge when status=TBD and key fields are empty | P1 | 🔲 draft | 2 |

**Total estimate:** 10 points

## Depends on

- [Epic 5](../epic-05-manual-entry-item-form/README.md) — items must exist with a status field before completeness can be aggregated.

## Unblocks

- [Epic 7 (PDF Export)](../epic-07-pdf-export/README.md) — the export preview reads completeness rollups directly (US-604).

## Source documents

- [`../../screen-inventory.md`](../../screen-inventory.md) § 4.1 Project Overview (group cards with TBD count), § 4.2 Group View (status badges), § 4.7 Item Detail/Edit (TBD field highlighting), § 5.1 Export Preview (warnings)
- [`../../user-flows.md`](../../user-flows.md) — Flow 4 (organize by group, review TBD/missing info)

## Architecture references

- [`../../architecture/database.md`](../../architecture/database.md) — aggregation queries on items by group + status
- Consider Postgres `GENERATED ALWAYS AS` for derived completeness columns, mirroring the pattern in [ADR-0007](../../architecture/adr/0007-auth-data-model.md) (`is_onboarded`).

## Notes for implementers

- **Three badge states** in the group view ([`screen-inventory.md`](../../screen-inventory.md) § 4.2): `Complete`, `TBD`, `Missing`. Definitions:
  - `Complete` = `status='complete'`
  - `TBD` = `status='tbd'` AND key fields filled
  - `Missing` = `status='tbd'` AND one or more key fields empty
  - "Key fields" needs a small design call — proposed: brand, finish, SKU. Document the chosen list in US-605's AC.
- **Warnings on export are non-blocking** ([`mvp-decisions.md`](../../mvp-decisions.md) § 5, [`screen-inventory.md`](../../screen-inventory.md) § 5.1, [`user-flows.md`](../../user-flows.md) Flow 5): "Draft exports always allowed. No fields are required before export. TBD items export as-is." Warnings inform; they never gate.
- **Reorder/rename doesn't affect status** — moving a group or renaming it must not invalidate any item's status.
