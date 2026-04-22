# Epic 7 — PDF Export

**Goal:** A designer exports a branded, client-ready spec sheet PDF in under 60 seconds — at any point in the project, even with TBD items. Free users see a blurred preview to know exactly what they're unlocking; Pro users download the full file.

**Primary persona:** [Designer](../personas.md#designer-designer--primary)

## Stories (planned)

> Stories in this epic are not yet written. The table below is the planned decomposition — file paths and IDs are reserved.

| ID | Title | Priority | Status | Est |
|----|-------|----------|--------|-----|
| US-701 | Trigger Export from project header (always visible) | P0 | 🔲 draft | 1 |
| US-702 | View export preview with summary (groups, items, TBD count) | P0 | 🔲 draft | 2 |
| US-703 | Toggle export scope: all groups vs select specific groups | P0 | 🔲 draft | 2 |
| US-704 | Download PDF (Pro plan) | P0 | 🔲 draft | 5 |
| US-705 | See blurred PDF preview with upgrade CTA (Free plan) | P0 | 🔲 draft | 3 |
| US-706 | Generate branded PDF — preserves group order and names | P0 | 🔲 draft | 5 |

**Total estimate:** 18 points

## Depends on

- [Epic 1](../epic-01-auth-onboarding/README.md) — authenticated session.
- [Epic 2](../epic-02-project-management/README.md) — project + groups exist with order.
- [Epic 5](../epic-05-manual-entry-item-form/README.md) — items exist to render.
- [Epic 6](../epic-06-completeness-status/README.md) — the preview summary reads completeness rollups.
- [Epic 8 (Billing)](../epic-08-billing-subscription/README.md) — the Free/Pro gate decides which path US-704 vs US-705 fires.

## Unblocks

- Nothing functional — PDF export is a leaf feature.

## Source documents

- [`../../mvp-decisions.md`](../../mvp-decisions.md) § 4 (Business model — Free shows blurred preview), § 5 (Branded PDF spec sheet only; draft exports always allowed)
- [`../../screen-inventory.md`](../../screen-inventory.md) § 5.1 Export Preview & Confirm, § 5.2 PDF Output (format reference)
- [`../../user-flows.md`](../../user-flows.md) — Flow 5 (Export at any time)

## Architecture references

- [ADR-0001 — Application framework: Next.js](../../architecture/adr/0001-application-framework.md) — PDF generation runs in a Route Handler, returns `application/pdf`
- [ADR-0009 — Storage: Supabase Storage](../../architecture/adr/0009-storage.md) — images embedded in the PDF come from the Speclyy CDN, not vendor URLs
- [`../../architecture/billing.md`](../../architecture/billing.md) — the Free/Pro gate decision logic

## Notes for implementers

- **Paywall lives here, not at sign-in** ([`mvp-decisions.md`](../../mvp-decisions.md) § 10): the only payment moment in the app is when a Free user clicks "Download PDF". The blurred preview shows the *exact* file they'd get.
- **Draft-friendly** ([`user-flows.md`](../../user-flows.md) Flow 5): no field is required to export. TBD items render as `—` or `TBD` per [`screen-inventory.md`](../../screen-inventory.md) § 5.2.
- **Group ordering is sacred** ([`screen-inventory.md`](../../screen-inventory.md) § 5.2): "Organized by Group (in designer-defined order, using designer-defined names exactly as entered)." US-205 (drag to reorder in Epic 2) and the rename flow must round-trip into the PDF.
- **PDF format reference** ([`screen-inventory.md`](../../screen-inventory.md) § 5.2):
  - Header: project name/address, studio name, date
  - Per item: product name, brand, colour, material, finish, dimensions, notes
  - Footer: Project / Schedule / Date | Page X of Y
  - Speclyy branding (no designer logo in MVP — that's MVP+1)
- **Library candidate for PDF generation**: not yet decided. Options include `@react-pdf/renderer` (component-based, works in Node), Puppeteer / Playwright HTML-to-PDF (reuses the scraper container), or a templating engine. Pick during implementation — call it out in US-706.
