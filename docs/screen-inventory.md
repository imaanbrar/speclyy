# Speclyy MVP — Screen Inventory

Derived from locked MVP decisions + PRD must-win workflows + Programa spec sheet reference.
Each screen includes: purpose, key elements, and which workflow it serves.

---

## 1. Auth & Entry

### 1.1 Sign-In
**Purpose:** Entry point for all users.
**Elements:** Speclyy logo, tagline, "Continue with Google" button, promo code field (optional, collapsible).
**Workflow:** All workflows (gate)

---

## 2. Onboarding (first sign-in only)

### 2.1 Onboarding — Your Name
**Purpose:** Personalise the workspace.
**Elements:** "What's your name?" prompt, first name + last name fields, Next button, progress indicator (1 of 4).

### 2.2 Onboarding — Studio Name
**Purpose:** Used on exported spec sheets.
**Elements:** "What's your studio called?" prompt, studio name field, Back + Next buttons, progress indicator (2 of 4).

### 2.3 Onboarding — Your Market
**Purpose:** Determines which local supplier inventory is surfaced in search.
**Elements:** "Where are you based?" prompt, 4 market options (Los Angeles / New York / Dallas / Calgary), single-select cards, Back + Next buttons, progress indicator (3 of 4).

### 2.4 Onboarding — Plan Overview
**Purpose:** Set honest expectations about the free plan before the designer reaches the dashboard. No decision required — they're already on Free.
**Elements:**
- Heading: "You're all set."
- Subtext: "You're on the Free plan — build unlimited specs and explore the product library. When you're ready to share your work, upgrade to Pro to unlock PDF export."
- Free vs Pro comparison table (same feature set as marketing pricing page)
- "Compare plans" hyperlink (opens full comparison, same table)
- Primary CTA: "Go to dashboard →" (no Back button — this is the final step)
- Progress indicator (4 of 4)

No upgrade prompt or payment flow here — comparison is informational only.

---

## 3. Dashboard

### 3.1 Projects List
**Purpose:** Home screen after sign-in. Overview of all active projects.
**Elements:** Header (logo, account menu), "New Project" CTA, project cards (project name, address/client, room count, item count, last modified), empty state ("Create your first project").

### 3.2 New Project — Create Modal
**Purpose:** Spin up a new project in seconds.
**Elements:** Project name field, client name (optional), address (optional), Create button.

---

## 4. Project

> **Grouping model:** Projects are organized into **Groups** — free-form named sections with no enforced taxonomy. A designer can name a group whatever makes sense for their project: "Plumbing Fixtures", "Master Ensuite", "Level 1 - Kitchen", "XYZ Commercial - Lobby", or anything else. The PDF export preserves these group names exactly as-is.

### 4.1 Project Overview
**Purpose:** Top-level view of a project — groups + items at a glance.
**Elements:** Project name + meta, "Export" button (always visible), "Add Group" button, group cards (group name, item count, TBD/missing count), completion status badge per group, drag-to-reorder groups.

### 4.2 Group View
**Purpose:** All items assigned to a specific group.
**Elements:** Group name header (inline-editable), "Add Item" button, item rows (image thumbnail, product name, brand, finish, SKU, status badge: Complete / TBD / Missing), item quick-actions (edit, remove), empty state.

### 4.3 Add Item — Search Library
**Purpose:** Find a product from the curated global library and add it to a group.
**Elements:** Search bar (keyword, e.g. "Kohler Billet"), filter chips (type: plumbing, paint — used for search/filter only, not imposed on groups), result cards (image, brand, collection, product name, finish options preview), "Add to Group" action per result, "Not finding it? Add manually / paste URL" fallback CTA.

### 4.4 Add Item — URL Paste
**Purpose:** Capture a product from any vendor page via URL.
**Elements:** URL input field, "Fetch" button, loading/scraping state (spinner + "Fetching product details..."), prefilled editable form (see 4.6), fallback message if scrape fails ("Couldn't fetch details — fill in manually").

### 4.5 Add Item — Manual Entry
**Purpose:** Quick-add a product with no URL.
**Elements:** Same editable form as 4.6 but blank. All fields optional except product name.

### 4.6 Item Form (shared — used by URL Paste, Manual Entry, Edit)
**Purpose:** Structured product data entry/edit.
**Fields:**
- Product Name (required)
- Brand
- Collection
- Finish / Variant
- SKU / Model #
- Colour
- Material
- Dimensions (W × H × D in inches)
- Product URL (source link)
- Image (auto-fetched or upload)
- Notes (free text)
- Group assignment (dropdown — lists the project's groups by name, whatever they are)
- Status (Complete / TBD)

**Actions:** Save to Project, Cancel.

### 4.7 Item Detail / Edit
**Purpose:** View or edit a saved item's full data.
**Elements:** All fields from 4.6 in view mode, Edit button to toggle to edit mode, product image, source URL link, status badge, Delete option.

---

## 5. Export

### 5.1 Export — Preview & Confirm
**Purpose:** Review before generating the PDF.
**Elements:** Export summary (project name, group count, item count, TBD count, missing fields count), optional "final-ready" warnings (non-blocking, e.g. "3 items missing SKU"), toggle: export all groups / select groups, "Download PDF" button.

### 5.2 PDF Output (not a screen — generated file)
**Format reference (from Programa spec sheet):**
- Header: Project name/address, studio name, date
- Organized by: Group (in designer-defined order, using designer-defined names exactly as entered)
- Per item: product name, brand, colour, material, finish, dimensions, notes
- Missing fields shown as "TBD" or "—"
- Footer: Project / Schedule / Date | Page X of Y
- Speclyy branding (MVP — no designer logo)

---

## 6. Account & Settings

### 6.1 Account Settings
**Purpose:** Edit profile details that appear on exports.
**Elements:** Name, studio name, market (editable), profile photo (optional), save button.

### 6.2 Subscription & Billing
**Purpose:** Manage plan and payment.
**Elements:** Current plan badge (Free / Pro), billing interval toggle (Monthly $37 / Annual $29/mo — 30% off), upgrade CTA for free users / manage billing CTA for Pro users (Stripe Customer Portal), promo code field.

---

## Summary

| # | Screen | Category |
|---|--------|----------|
| 1.1 | Sign-In | Auth |
| 2.1 | Onboarding — Name | Onboarding |
| 2.2 | Onboarding — Studio | Onboarding |
| 2.3 | Onboarding — Market | Onboarding |
| 2.4 | Onboarding — Plan Overview | Onboarding |
| 3.1 | Projects List | Dashboard |
| 3.2 | New Project Modal | Dashboard |
| 4.1 | Project Overview | Project |
| 4.2 | Group View | Project |
| 4.3 | Add Item — Search Library | Project |
| 4.4 | Add Item — URL Paste | Project |
| 4.5 | Add Item — Manual Entry | Project |
| 4.6 | Item Form (shared) | Project |
| 4.7 | Item Detail / Edit | Project |
| 5.1 | Export Preview & Confirm | Export |
| 5.2 | PDF Output (generated) | Export |
| 6.1 | Account Settings | Settings |
| 6.2 | Subscription & Billing | Settings |

**Total: 17 screens (16 UI screens + 1 generated PDF)**
