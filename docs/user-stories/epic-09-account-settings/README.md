# Epic 9 — Account Settings

**Goal:** A designer can edit the profile data they entered during onboarding — because studios rebrand, designers move markets, and people don't always type their last name correctly the first time. These edits feed straight into PDF exports.

**Primary persona:** [Designer](../personas.md#designer-designer--primary)

## Stories (planned)

> Stories in this epic are not yet written. The table below is the planned decomposition — file paths and IDs are reserved.

| ID | Title | Priority | Status | Est |
|----|-------|----------|--------|-----|
| US-901 | Edit profile name (first + last) | P0 | 🔲 draft | 1 |
| US-902 | Edit studio name (appears on PDF export) | P0 | 🔲 draft | 1 |
| US-903 | Change market selection (LA / NY / Dallas / Calgary) | P1 | 🔲 draft | 1 |
| US-904 | Upload an optional profile photo | P2 | 🔲 draft | 2 |

**Total estimate:** 5 points

## Depends on

- [Epic 1](../epic-01-auth-onboarding/README.md) — `profiles` row exists.

## Unblocks

- [Epic 7 (PDF Export)](../epic-07-pdf-export/README.md) — studio name (US-902) is rendered in the PDF header.

## Source documents

- [`../../screen-inventory.md`](../../screen-inventory.md) § 6.1 Account Settings
- [`../../mvp-decisions.md`](../../mvp-decisions.md) § 10 — Onboarding fields that this screen lets users edit

## Architecture references

- [ADR-0007 — Auth data model: `profiles` table](../../architecture/adr/0007-auth-data-model.md) — schema for `first_name`, `last_name`, `studio_name`, `market`
- [ADR-0009 — Storage: Supabase Storage](../../architecture/adr/0009-storage.md) — profile photo upload
- [`../../architecture/storage.md`](../../architecture/storage.md) — image transform pipeline

## Notes for implementers

- **Same fields, edited later.** Stories US-901, US-902, US-903 edit the exact same `profiles` columns populated by US-102, US-103, US-104. Reuse the validation logic.
- **Market constraint** matches the DB CHECK constraint ([ADR-0007](../../architecture/adr/0007-auth-data-model.md)): only `los_angeles`, `new_york`, `dallas`, `calgary`.
- **Profile photo is P2.** Not currently surfaced anywhere in the MVP — the PDF doesn't include it ([`screen-inventory.md`](../../screen-inventory.md) § 5.2: "no designer logo in MVP"). Defer until there's a surface that displays it.
- **Email is read-only.** It comes from Google OAuth; changing it would require account migration. Out of scope for MVP.
