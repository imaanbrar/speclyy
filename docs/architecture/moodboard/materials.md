# Materials

Two layers cohabit on a board: **`project_items`** (real specifiable goods — sinks, sofas, faucets) and **`board_materials`** (moodboard-only artefacts — paint chips, fabric swatches, abstract palette pieces). Plus designer **uploads** (`board_assets`) for photos that aren't products.

This page covers the `board_materials` table, the procedural render recipe, and how the four library sources are unioned.

See [README.md](README.md) for the broader architecture and [board-persistence.md](board-persistence.md) for how items get on the canvas.

---

## Why a second table

`project_items` is shaped for goods that go into a spec sheet — it has SKU, brand, finish, dimensions, status (`complete | tbd`). A paint chip with `hex = '#B4572C'` doesn't fit naturally: there's no SKU, no dimensions, and forcing it through `project_items.colour` mixes spec-sheet output with moodboard-only colour swatches.

Two tables, both referenceable from `board_items`:

```
board_items.ref_kind ─┬─ 'product'  → project_items
                     ├─ 'material' → board_materials
                     ├─ 'asset'    → board_assets
                     └─ 'swatch'/'note'/'text' → no ref (inline in document)
```

The board document doesn't care which side a referenced item lives on — the renderer joins through `board_items` to whichever table holds the truth.

---

## `board_materials` schema

```sql
CREATE TABLE public.board_materials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid REFERENCES public.profiles(id),
  org_id          uuid REFERENCES public.organizations(id),
  kind            text NOT NULL CHECK (kind IN (
                    'paint','fabric','tile','wallpaper','rug','finish','hardware','other')),
  name            text NOT NULL,
  brand           text,
  sku             text,
  hex             text,                     -- paint, accent
  thumbnail_url   text,                     -- Supabase Storage or scraped image URL
  scrape_cache_id uuid REFERENCES public.scrape_cache(id),
  render          jsonb,                    -- procedural recipe (see below)
  meta            jsonb NOT NULL DEFAULT '{}',  -- supplier, price, finish list, sample availability
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX board_materials_owner_idx ON public.board_materials (owner_id);
CREATE INDEX board_materials_org_idx   ON public.board_materials (org_id) WHERE org_id IS NOT NULL;
```

**Ownership semantics:**

| `owner_id` | `org_id` | Visibility |
|---|---|---|
| set | null | Designer's private library |
| set | set | Designer authored, shared with their studio |
| null | set | Studio-shared, no specific author |
| null | null | Curated / seeded baseline |

A material can be promoted from private → studio-shared by setting `org_id`. Studio members can fork a curated material into their own private library by inserting a copy with `owner_id = self`.

---

## Render recipe (`render`)

A material has either a `thumbnail_url` (real image — usually scraped) **or** a procedural `render` recipe (CSS gradients + SVG, no image needed). Most materials in production will have both: the recipe acts as a fast-loading fallback while the thumbnail loads, and as a vector-style export for the SVG export pipeline.

The recipe is a discriminated union — a small DSL the client interprets.

```ts
type RenderRecipe =
  | { type: 'solid';     hex: string }
  | { type: 'gradient';  stops: Array<{ at: number; hex: string }>; angle?: number }
  | { type: 'paint';     hex: string; sheen?: number }                 // matte→satin via inset shadow
  | { type: 'terrazzo';  base: string; chips: string[]; chipSize?: number; chipDensity?: number }
  | { type: 'boucle';    base: string; loops: string[]; nubbiness?: number }
  | { type: 'velvet';    hex: string; pile?: number }                  // soft directional sheen
  | { type: 'linen';     warp: string; weft: string; thread?: number }
  | { type: 'marble';    base: string; veins: string[]; veinDensity?: number }
  | { type: 'travertine';base: string; pores: string[] }
  | { type: 'tileGrid';  tile: string; grout: string; tileSize: number }
  | { type: 'pattern';   svgRef: string; tint?: string }               // references a registered svg defs id
```

The client component `<SwatchVisual>` switches on `type` and emits CSS gradients + SVG `defs` referenced by the surface. Recipes are deterministic given a seed (we hash the material id), so the same material renders identically across boards.

**Scope discipline:** the recipe DSL is small on purpose. New types are added when we have a real material that doesn't fit existing types — never speculatively. New types must round-trip through the SVG exporter (so the export.md path stays simple).

---

## Where thumbnails come from

| Source | Path |
|---|---|
| URL paste | The existing scraper extracts `image_url` and re-hosts to `product-images` Supabase Storage bucket; that URL is stamped onto `board_materials.thumbnail_url`. Same flow as `project_items`. |
| Designer upload | Lands in `board-uploads` bucket via a Server Action; the path is stamped onto `thumbnail_url`. |
| Curated seed | Internal team uploads to `product-images`; URL is committed in seed data. |
| Studio-shared | Inherits whichever path the original used. |

`thumbnail_url` is always a **public-read** URL (signed-URL pattern is reserved for `board-exports` per [export.md](export.md)). RLS on `board_materials` prevents enumerating private materials, but if a designer hands out a thumbnail URL, the image itself is reachable — same model as `project_items.image_url`.

---

## Library — the four sources

The library rail unions:

```
                ┌──────────────────────┐
                │   global_products    │   curated catalogue
                ├──────────────────────┤
                │   project_items      │   my prior items (across all my projects)
LIBRARY ──────  │   board_materials    │   studio-shared (where org_id = my org)
                ├──────────────────────┤
                │   scrape_cache via   │   paste-a-URL-now (existing scraper)
                │   on-demand scrape   │
                └──────────────────────┘
```

Each source is normalised at query time into a `LibraryEntry` shape:

```ts
type LibraryEntry = {
  id: string                                 // prefixed: 'gp-…', 'pi-…', 'bm-…'
  source: 'global' | 'mine' | 'studio' | 'scraped'
  kind: MaterialKind | 'product'
  name: string
  brand?: string
  sku?: string
  thumbnail_url?: string
  hex?: string
  render?: RenderRecipe
  // back-references for resolution when added to canvas
  project_item_id?: string
  material_id?: string
}
```

The library UI tabs (All / Fabric / Tile / Paint / Objects / Other) filter the union client-side. Supplier filter chips union `global_products.brand` and `board_materials.brand` for the current source set.

When the designer drops a `LibraryEntry` on the canvas, we materialise it:

- `source = 'global'` → create a new doc-tree item with `kind: 'product'` and `ref.project_item_id` after upserting a `project_items` row that points at the global product.
- `source = 'mine'` → reference the existing `project_items` row directly.
- `source = 'studio'` → reference the existing `board_materials` row directly.
- `source = 'scraped'` → if the scrape result looks like a specifiable good, prompt the designer ("add to project items?") — otherwise create a `board_material`.

The scraper-result-to-material-or-product disambiguation is heuristic (presence of dimensions / SKU / brand) and is the only place the union has a non-trivial decision. Full detail in [import.md](import.md).

---

## Procedural rendering — performance notes

`<SwatchVisual>` returns CSS gradients + at most one inline SVG `<filter>` or `<pattern>`. For ~200 items on a board:

- Gradient definitions are cheap (no per-frame layout cost).
- SVG `<defs>` are deduped per recipe `type` — the canvas mounts one `<svg>` of registered defs, individual items reference them by id.
- Procedural recipes seeded by material id render identically run-to-run, so React's keyed reconciliation doesn't re-mount on re-render.

If a board exceeds the budget (200 items / 60 fps), the first lever is virtualising off-screen items — the procedural recipes themselves are not the bottleneck.

---

## Accessibility

Each rendered swatch has an `aria-label` composed of `name` + `kind` + (if hex) the hex value (`"Tierras Senape, tile, base #D8C28A"`). Screen readers can't describe a procedural pattern, but the structured label is enough for a designer's spec-sheet workflow.

---

## Open items

- Material variants (one base material with multiple finishes / colourways) — currently each variant is its own row. Adding a `variant_of_id` self-reference is straightforward but waiting for a real product use case.
- Material tags (`'warm'`, `'natural'`, `'mediterranean'`) for AI search — out of scope for v1.
- Sample-ordering UX (designers want to order physical samples from suppliers) — captured in `meta`, surfaced as a v2 button.

---

## References

- [README.md](README.md) — moodboard overview
- [import.md](import.md) — library sources, scraper integration
- [board-persistence.md](board-persistence.md) — how a `LibraryEntry` becomes a doc-tree item
- [export.md](export.md) — how render recipes round-trip to SVG export
- [../database.md](../database.md) — `project_items`, `global_products` parent schema
- [../scraper/README.md](../scraper/README.md) — URL paste pipeline
