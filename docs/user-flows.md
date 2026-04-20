# Speclyy MVP — User Flows

The 5 must-win workflows mapped step-by-step across screens.
Screen references match `screen-inventory.md`.

---

## Flow 1 — Search library → add to project in seconds

**Goal:** Designer finds a known product in the global library and adds it to a group.
**Success criteria:** Product added in under 30 seconds from opening the project.

```
[4.2 Group View]
  → Click "Add Item"

[4.3 Add Item — Search Library]
  → Type keyword (e.g. "Kohler Billet")
  → Results appear (image, brand, product name, finish preview)
  → Click "Add to Group" on desired result
  → Select group from dropdown (or current group is pre-selected)
  → Item added ✓

[4.2 Group View]
  → Item appears in list with status badge
  → If finish not selected → status: TBD
  → If finish selected → status: Complete
```

**Happy path:** 3 interactions — search, select result, confirm group.
**Edge case:** Multiple finish options → modal to pick finish before adding (or add as TBD and edit later).

---

## Flow 2 — Not found → paste URL → AI prefill → save

**Goal:** Designer finds a product on a vendor site, pastes the URL, and Speclyy prefills the fields.
**Success criteria:** Product captured and saved in under 2 minutes, including any manual corrections.

```
[4.3 Add Item — Search Library]
  → Search returns no match
  → Click "Not finding it? Paste a URL"

[4.4 Add Item — URL Paste]
  → Paste product URL
  → Click "Fetch"
  → Loading state: "Fetching product details..." (spinner)

  → SUCCESS PATH:
    → Form prefills: product name, brand, image, finish options, SKU, dimensions
    → Designer reviews and corrects any wrong/missing fields
    → Selects group assignment
    → Click "Save to Project"
    → Item added ✓

  → FALLBACK PATH (scrape fails):
    → Message: "Couldn't fetch details — fill in manually"
    → URL is saved, form is blank but pre-populated with URL
    → Designer fills fields manually → Save to Project
    → Item added ✓

[4.2 Group View]
  → Item appears with fields from prefill
  → Missing fields flagged as TBD
```

**Happy path:** Paste URL → review prefilled form → save. ~4 interactions.
**Edge case:** Scrape partial (gets name but not SKU) → show what was found, flag missing fields as TBD.

---

## Flow 3 — Not found → manual entry → save

**Goal:** Designer adds a product with no URL — from memory, a showroom visit, or a PDF quote.
**Success criteria:** Product saved in under 60 seconds with at minimum a name.

```
[4.3 Add Item — Search Library]
  → Click "Add manually" (or via [4.2 Group View] → "Add Item" → "Manual Entry")

[4.5 Add Item — Manual Entry]
  → Blank form (all fields optional except product name)
  → Designer fills in what they know
  → Selects group assignment
  → Click "Save to Project"
  → Item added ✓

[4.2 Group View]
  → Item appears
  → Unfilled fields show as TBD
  → Designer can return to edit anytime via [4.7 Item Detail / Edit]
```

**Happy path:** Open form → type name → save. 2 interactions minimum.
**Key principle:** No field is blocking. A name alone is enough to save.

---

## Flow 4 — Organize by group, review TBD/missing info

**Goal:** Designer sees the full project at a glance, identifies gaps, and edits items with missing data.
**Success criteria:** Designer can find every incomplete item across the project without hunting.

```
[4.1 Project Overview]
  → See all groups as cards
  → Each card shows: group name, item count, TBD count
  → Groups with missing data are visually flagged (e.g. "3 TBD")
  → Click a group card

[4.2 Group View]
  → See all items in the group
  → Each item row shows status badge: Complete / TBD / Missing
  → TBD items are visually distinct (e.g. muted, flagged icon)
  → Click an item to open [4.7 Item Detail / Edit]

[4.7 Item Detail / Edit]
  → View mode: see all fields, TBD fields highlighted
  → Click "Edit"
  → Fill in missing fields
  → Save
  → Status badge updates ✓

[4.2 Group View]
  → Item now shows updated status
```

**Reorder flow:**
```
[4.1 Project Overview]
  → Drag group cards to reorder
  → Order is preserved in PDF export
```

**Rename group flow:**
```
[4.2 Group View]
  → Click group name (inline edit)
  → Type new name → Enter
  → Saved instantly ✓
```

---

## Flow 5 — Export PDF at any time (draft-friendly)

**Goal:** Designer exports a spec sheet — whether complete or still in progress — to share with a client or trade.
**Success criteria:** PDF downloaded in under 60 seconds from any point in the project.

```
[4.1 Project Overview] or [4.2 Group View]
  → Click "Export" button (always visible in header)

[5.1 Export — Preview & Confirm]
  → Summary: X groups, Y items, Z TBD fields
  → Non-blocking warnings listed (e.g. "4 items missing SKU", "2 items missing finish")
  → Toggle: Export all groups / Select specific groups
  → Click "Download PDF"

  → PDF generates
  → Browser downloads file ✓

[PDF — 5.2]
  → Header: project name/address, studio name, date
  → Groups in designer-defined order, names exactly as entered
  → Each item: product name, brand, colour, material, finish, dimensions, notes
  → TBD fields shown as "—"
  → Footer: Project / Schedule / Date | Page X of Y
  → Speclyy branding
```

**Draft export:** Always allowed. No fields are required before export. TBD items export as-is.
**Partial export:** Designer can deselect groups to export only specific sections.

---

## Supporting Flow — First-time setup (one-time, precedes all above)

```
[1.1 Sign-In]
  → Click "Continue with Google"
  → Google OAuth handshake

[2.1 Onboarding — Name]
  → Enter first + last name → Next

[2.2 Onboarding — Studio]
  → Enter studio name → Next

[2.3 Onboarding — Market]
  → Select market (LA / NY / Dallas / Calgary) → Finish

[3.1 Projects List]
  → Empty state: "Create your first project"
  → Click → [3.2 New Project Modal]
  → Enter project name (+ optional client, address) → Create

[4.1 Project Overview]
  → Empty state: "Add your first group"
  → Click "Add Group" → type group name → Enter
  → Group created → proceed to Flow 1, 2, or 3
```

---

## Flow coverage map

| Screen | Flow 1 | Flow 2 | Flow 3 | Flow 4 | Flow 5 |
|--------|--------|--------|--------|--------|--------|
| 1.1 Sign-In | — | — | — | — | — |
| 2.1–2.3 Onboarding | — | — | — | — | — |
| 3.1 Projects List | ✓ | ✓ | ✓ | ✓ | ✓ |
| 3.2 New Project | ✓ | ✓ | ✓ | ✓ | ✓ |
| 4.1 Project Overview | ✓ | ✓ | ✓ | ✓ | ✓ |
| 4.2 Group View | ✓ | ✓ | ✓ | ✓ | — |
| 4.3 Search Library | ✓ | ✓ | ✓ | — | — |
| 4.4 URL Paste | — | ✓ | — | — | — |
| 4.5 Manual Entry | — | — | ✓ | — | — |
| 4.6 Item Form | ✓ | ✓ | ✓ | ✓ | — |
| 4.7 Item Detail/Edit | — | — | — | ✓ | — |
| 5.1 Export Preview | — | — | — | — | ✓ |
| 5.2 PDF Output | — | — | — | — | ✓ |
