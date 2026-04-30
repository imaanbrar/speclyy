# Canvas

How the freeform canvas is implemented — state, interaction, geometry, and the boundary between in-memory editing and the serialized document.

See [board-persistence.md](board-persistence.md) for how the canvas state is saved and [README.md](README.md) for the broader architecture.

---

## State model

The canvas state in memory mirrors the persisted document tree (`boards.document`):

```ts
type CanvasState = {
  size: { w: number; h: number }      // logical paper size, e.g. 1280×900
  layout: 'freeform' | 'zones' | 'grid'
  items: BoardItem[]                  // see board-persistence.md for the union type
  selectedId: string | null
  zoom: number                        // 40..140 (% of logical size)
  pan: { x: number; y: number }       // viewport offset
}
```

Mutations are always through reducer-style helpers (`updateItem`, `addItem`, `removeItem`, `bringFront`, `sendBack`, `duplicate`) so the autosaver sees a single new document state per atomic edit. Direct in-place mutation is forbidden — it makes undo/redo and CRDT migration painful later.

---

## The two coordinate spaces

```
┌──────────────────────────────────────────┐
│  Viewport (CSS pixels)                    │
│  ┌────────────────────────────────────┐  │
│  │  Paper (logical pixels — 1280×900) │  │
│  │  ┌─────────┐                       │  │
│  │  │ item    │  item.frame is in     │  │
│  │  │ frame   │  PAPER coordinates,   │  │
│  │  └─────────┘  not viewport.        │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘

paper-to-viewport:    viewport_xy = paper_xy * zoom + pan
viewport-to-paper:    paper_xy    = (viewport_xy - pan) / zoom
```

**Item frames are always stored in paper coordinates.** Zoom and pan are viewport-only state — they don't round-trip through the document. This keeps `boards.document` the same regardless of what the designer was zoomed to when they last saved.

---

## Drag, resize, rotate

All three use the same low-level pattern: `mousedown` on the item or handle → install `mousemove` + `mouseup` listeners on `window` → translate viewport-space deltas back into paper-space deltas via the zoom factor.

```ts
function startDrag(e: MouseEvent, item: BoardItem) {
  const startX = e.clientX, startY = e.clientY
  const ox = item.frame.x, oy = item.frame.y
  const onMove = (ev: MouseEvent) => {
    updateItem(item.id, {
      frame: {
        ...item.frame,
        x: ox + (ev.clientX - startX) / zoom,
        y: oy + (ev.clientY - startY) / zoom,
      },
    })
  }
  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}
```

We deliberately **do not** use HTML5 drag-and-drop for on-canvas movement. HTML5 DnD has too many quirks (drag images, drop targets, transparent ghost windows) for free-form spatial editing. We *do* use HTML5 DnD for one thing only: the library-card → canvas drop, because that drop event carries `dataTransfer` cleanly across the panel boundary.

| Interaction | Mechanism |
|---|---|
| Library → canvas | HTML5 DnD (`dragstart`, `dragover`, `drop`) — single boundary crossing |
| On-canvas drag | `mousedown` + window listeners |
| Resize handle | Same pattern, scales `frame.w` / `frame.h` |
| Rotate (toolbar +6°) | One-shot mutation — no live drag handle in v1 |
| Z-order (Bring/Send) | Recompute `frame.z` against current min/max |
| Duplicate | Clone with `+24, +24` offset, fresh id |

### Resize math

Resize is uniform from the bottom-right corner, scaled by zoom:

```
new_w = max(MIN, original_w + (mouse_dx / zoom))
new_h = max(MIN, original_h + (mouse_dy / zoom))
```

`MIN = 60` paper-pixels. The toolbar rotates in fixed 6° steps; a drag-rotate handle is a v2 enhancement (along with proportional resize from arbitrary corners and shift-key snapping).

### Rotation note

`frame.rot` is the visual rotation in degrees (CSS `transform: rotate(…deg)`). Hit-testing is *not* rotation-aware in v1 — items are clicked via their AABB. This is fine for typical 0–10° aesthetic tilts; if we add free-rotate handles later we'll need oriented bounding-box hit testing.

---

## Zoom & pan

- Zoom is a CSS `transform: scale(z)` on the paper element with `transform-origin: top center`.
- Discrete zoom levels (40, 50, 60, … 140%) — no smooth zoom in v1.
- Pan is implicit: the paper is wider than the viewport, the viewport scrolls. (No "hand tool" yet; users scroll naturally.)

A future "fit to canvas" / "100%" / "fit selection" set of toolbar buttons is straightforward — they just compute target zoom + scroll offset from the union of selected item frames.

---

## Selection & toolbar

Single-selection only in v1. The selected item gets:

- A 1.5px outline in the accent color (offset by 4px so it doesn't clip the item).
- A floating toolbar above the item (bring-front, send-back, rotate +6°, duplicate, delete) — positioned in viewport space so it doesn't tilt with the item.
- A bottom-right resize handle (12×12 dot in the accent color).

Multi-select with marquee drag, group-move, and keyboard nudges (arrows = 1px, shift+arrow = 10px) are explicitly v2 — they're cheap to add later and not on the v1 critical path.

---

## Layout modes

```
freeform  no guides — just paper
zones     four loose quadrant labels (Floor & walls / Textiles / Paint chips / Furniture & lighting)
grid      visible 160×160 grid; snapping is OPT-IN per-item (v2), not global yet
```

Layout is a CSS class toggle on the paper element; it does not affect item frames. Switching modes never moves items — it just changes background guide rendering.

---

## In-session undo/redo (v1)

A bounded ring buffer of recent `CanvasState` snapshots, capped at 32 entries. Undo and redo replace the current state wholesale.

```ts
type History = {
  past: CanvasState[]
  present: CanvasState
  future: CanvasState[]
}
```

A snapshot is pushed on every "atomic" edit (drag-end, resize-end, add, delete, paste). Mid-drag positions are not snapshotted — undo from a 30-frame drag should jump back to before the drag, not unwind it frame by frame.

This is independent of `board_revisions`, which is the persisted recovery system documented in [board-persistence.md](board-persistence.md).

---

## Performance budget

The canvas should hold ~200 items at 60 fps on a 2020-class laptop. Key constraints:

- **DOM, not canvas.** Items are positioned `<div>`s — keeps accessibility, copy/paste, browser zoom, and printing all working. Hard ceiling around 500 items; if a designer hits that, we'll virtualize off-screen items, not switch to `<canvas>`.
- **No layout thrash on drag.** Mid-drag mutation only updates the dragged item's `frame` — sibling items aren't re-rendered (React's reconciliation handles this cheaply because their props are referentially stable).
- **Heavy procedural visuals are CSS.** Procedural swatches (terrazzo, boucle, paint chips) are CSS gradients + small SVG defs. No `<img>` per swatch.

---

## Accessibility

In-scope for v1:

- Keyboard navigation between items (Tab cycles, arrow keys nudge, Delete removes).
- Screen-reader labels per item (e.g. "Carrara console, 200×200, rotated -2 degrees, position 3 of 14").
- High-contrast outline color in the dark paper theme.

Out of scope for v1:

- Full screen-reader narration of spatial relationships.
- Reduced-motion alt for the rotation animations (already minimal).

---

## Open items

- Free-rotate handle and oriented hit-testing.
- Multi-select + marquee + group-move.
- Snap-to-grid (when layout = grid) and snap-to-edge alignment guides.
- Smart guides ("align to other selected item").
- Mobile/tablet pointer support (currently mouse-only).

---

## References

- [README.md](README.md) — moodboard overview
- [board-persistence.md](board-persistence.md) — how canvas state serializes
- [materials.md](materials.md) — what items render *as* (the visual recipe layer)
