# Export

How a moodboard becomes a deliverable. Five formats:

| Format | What | Engine | Auth |
|---|---|---|---|
| PNG | Raster image of the canvas | Server-side Playwright (existing scraper pool on Fly.io) | Authed |
| PDF — moodboard | Single-page visual PDF | Server-side Playwright `page.pdf()` | Authed |
| PDF — spec sheet | Multi-page tabular spec PDF (existing renderer, scoped to board's project) | Existing spec-sheet renderer | Authed |
| Shareable web link | Public `/share/[token]` URL | Route Handler ([sharing.md](sharing.md)) | Token-scoped |
| `.speclyy-board.json` | Self-contained portable file | Direct dump from `boards.document` + dereferenced refs | Authed |
| Canva interop | PDF + SVG download bundle (Canva has no public import API) | Same Playwright path, with a vector SVG sibling | Authed |

See [board-persistence.md](board-persistence.md) for the document the renderer consumes.

---

## Render service (PNG, PDF, SVG)

The Fly.io scraper service exposes a second endpoint: `/render`. It reuses the **same browser pool** that handles vendor scrapes — zero new infra, just a different navigation target.

```mermaid
flowchart LR
  Designer["Designer clicks Export"] --> SA[Server Action\n exportBoard]
  SA -->|emit Inngest event| IN[Inngest\n moodboard/export.requested]
  IN --> R[Render service\n /render?board=ID&format=png|pdf|svg]
  R -->|navigate to| P["moodboard.speclyy.com/board/[id]/print?token=…"]
  P -->|server-side render| HTML[Print stylesheet\n (read-only, no shell chrome)]
  R -->|page.screenshot/.pdf| OUT[bytes]
  R -->|upload| ST[(Supabase Storage\n board-exports bucket)]
  R -->|callback| SA
  SA -->|signed URL| Designer
```

### Why server-side, not client-side

- **Fidelity.** Print stylesheet renders exactly the same on every machine. No "your screenshot looks fuzzy on retina" support tickets.
- **Canvas size.** A 1280×900 board exported at 3× DPI is 11 MP — `html2canvas`-style client export thrashes weak machines.
- **Security.** PDFs need fonts and assets the client may not have hot.
- **Reuse.** The Fly.io browser pool already exists for scraping. Renaming the entry point is cheaper than spinning up Vercel-bound print routes.

### The print route

`apps/moodboard/src/app/board/[id]/print/page.tsx` is a server-rendered, full-bleed, no-shell variant of the studio shell:

- No sidebar, library, or toolbars.
- A single full-bleed paper element sized to `boards.document.size`.
- Items rendered with the same components, but `interactive={false}`.
- Authenticated by an **export token** in the query string — a short-lived signed JWT that the render service receives from the Server Action and forwards to Playwright. This avoids cookie plumbing.

### Format paths

| Format | Playwright call | Output |
|---|---|---|
| PNG | `page.screenshot({ type: 'png', omitBackground: false, fullPage: false, clip: ... })` | Bytes → upload to `board-exports/{board}/{rev}.png` |
| PDF | `page.pdf({ width, height, printBackground: true })` | Single page sized to canvas |
| SVG | Custom: serialize the document tree to SVG via a server-side SVG builder (no Playwright needed) | Vector — for Canva-compatible imports |

### Throttling + caching

- **Cache key.** `(board_id, rev, format)` — if a render with the same triple exists, the Server Action returns its signed URL without re-rendering.
- **Inngest concurrency.** Per-org concurrency cap (e.g. 3 in flight) so a studio bulk-exporting can't starve the scraper pool.
- **SLA.** PNG ≤ 5s p95; PDF ≤ 8s p95. The UI streams a "Rendering…" indicator and pushes a Realtime update on completion.

---

## Spec-sheet PDF (existing renderer)

The moodboard doesn't ship a *new* spec-sheet renderer — it reuses the existing one (the same path that prints from `/projects/[id]`).

The integration:

```ts
'use server'
export async function exportSpecSheetForBoard(boardId: string) {
  const board = await getBoard(boardId)
  const productItemIds = await db.select({ id: boardItems.projectItemId })
    .from(boardItems)
    .where(and(eq(boardItems.boardId, boardId), isNotNull(boardItems.projectItemId)))

  // Pass into the existing spec-sheet renderer, with board name as the title.
  return renderSpecSheet({
    projectId: board.projectId,
    title: board.name,
    onlyItemIds: productItemIds.map(r => r.id),
    groupId: board.parentKind === 'group' ? board.groupId : null,
  })
}
```

Items that aren't `project_items` (paint chips, materials, uploads, notes) are **excluded** — the spec sheet is a goods document. The PDF moodboard above is what carries the visual narrative.

---

## Shareable web link

Same pipeline as [sharing.md](sharing.md) — a `board_shares` row with `access = 'view'`. The export panel and the share panel are merged in the UI: "Share with client" creates the link, and the same modal offers PDF/PNG download alongside.

---

## `.speclyy-board.json`

```ts
'use server'
export async function exportBoardJson(boardId: string) {
  const board   = await getBoard(boardId)
  const items   = await getBoardItemsWithRefs(boardId)
  const assets  = await getReferencedAssets(boardId)
  const refs    = await getReferencedExternals(boardId)  // project_items, materials

  return {
    format: 'speclyy-board',
    format_version: 1,
    exported_at: new Date().toISOString(),
    exported_from: `https://moodboard.speclyy.com/board/${boardId}`,
    board: {
      name: board.name,
      brief: board.brief,
      palette: board.palette,
      document: board.document,
    },
    assets,                            // [{ id, url, w, h }]
    external_refs: refs,               // denormalised snapshot for portability
  }
}
```

On import (`importBoardJson`), the importer walks `external_refs`:

- For each `project_item`: try to find a matching `(brand, sku)` pair in the importing user's `project_items`. If hit → re-link. If miss → create a `board_material` shadow with `meta.imported_from = 'export'` and rewrite the document tree to point at the new id.
- For each asset: re-upload to the importer's `board-uploads` bucket with a fresh `storage_path`; rewrite urls.
- The result is a fully self-contained, working board in the importer's workspace.

This is what makes boards portable across designers (sharing concept files) and across Speclyy environments (template galleries, cross-studio collab in the future).

---

## Canva interop — caveat

> Canva does not expose a public import API for its native format (`.canva`). We can't write a one-click "Open in Canva" path. What we *can* do is hand the designer a clean PDF + SVG bundle that Canva imports natively.

The Canva button in the UI:

```
┌──────────────────────────────────────────┐
│ Download for Canva                       │
│ ────────────────────────                 │
│ ▾ PDF — pixel-perfect (recommended)      │
│ ▾ SVG — editable in Canva (vector items) │
│                                          │
│ Note: Canva has no direct import API.    │
│ Upload the PDF or SVG into your Canva    │
│ workspace to continue editing there.     │
└──────────────────────────────────────────┘
```

The SVG is the one path that preserves editability — vector items (swatches, paint chips, text, notes) round-trip cleanly. Raster items (uploads, scraped product photos) embed as image elements.

If Canva ever publishes an import API, this becomes a one-click flow without changing the underlying renderer.

---

## Storage

A new bucket `board-exports`:

```
board-exports/{board_id}/{rev}.png
board-exports/{board_id}/{rev}.pdf
board-exports/{board_id}/{rev}.svg
```

- **Public-read** with signed URLs gated by Server Action — same pattern as `product-images`.
- **Lifecycle.** Exports are immutable (keyed on `rev`). A nightly cron deletes export artifacts where `rev < boards.rev - 50` to bound storage cost.
- **No ACL on the bucket itself** — access control is via signed URLs created by Server Actions that check the user can read the board.

See [../storage.md](../storage.md) for the bucket-and-signed-URL pattern.

---

## Open items

- Page-size presets for PDF (A3 landscape default? letter? "fit to canvas"?). Currently the PDF page matches the canvas size — designers may want preset sizes for printing.
- Watermarking on shared-link views (subtle "Made with Speclyy" footer) — nice-to-have, not blocking.
- Bulk export — "export all boards in this project as a zipped PDF set" — a v2 once one-board export is solid.

---

## References

- [README.md](README.md) — moodboard overview
- [board-persistence.md](board-persistence.md) — document model that the renderer consumes
- [sharing.md](sharing.md) — share-link mechanics (one of the export targets)
- [../scraper/README.md](../scraper/README.md) — same Fly.io service hosts the renderer
- [../scraper/performance.md](../scraper/performance.md) — browser pool and pre-warm strategy reused
- [../storage.md](../storage.md) — `board-exports` bucket pattern
