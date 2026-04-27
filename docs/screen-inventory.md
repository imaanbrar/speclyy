# Speclyy MVP — Screen Inventory

Derived from locked MVP decisions + PRD must-win workflows + Programa spec sheet reference.
Each screen includes: purpose, key elements, and which workflow it serves.

---

## 1. Auth & Entry

### 1.1 Sign-In
**Purpose:** Entry point for all users. Single page — Google + email magic-link on the same screen.
**Elements:** Speclyy logo, tagline, "Continue with Google" pill button, "or" divider, email input with inline "Send link" button, helper copy ("We'll email a magic link and a 6-digit code — no password."), Terms + Privacy footer links.
**Workflow:** All workflows (gate)

### 1.2 Sign-In — Verify code
**Purpose:** For users who use the 6-digit code instead of clicking the magic link.
**Elements:** 6-digit code input, "Resend code" button with 60s cooldown, rate-limit messaging.

---

## 2. Onboarding (first sign-in only)

### 2.1 Onboarding — Your Name
**Purpose:** Personalise the workspace.
**Elements:** "What's your name?" prompt, first name + last name fields, Next button, progress indicator (1 of 4).

### 2.2 Onboarding — Studio
**Purpose:** Used on exported spec sheets; also establishes the `studios` record that will hold future teammates.
**Elements:** "Where do you practice?" prompt, studio name field, **studio size** selector (Just me / 2–5 / 6–10 / 11+), Back + **Skip** + Continue, progress indicator (2 of 4).
**Skip behavior:** auto-creates a studio named `"{first_name} {last_name}"` with null size — the profile is never left without a studio.

### 2.3 Onboarding — Your Market
**Purpose:** Captures the designer's city for spec-sheet display and (when matched against curated coverage) for surfacing local supplier inventory in Library search. See [ADR-0020](architecture/adr/0020-onboarding-market-global-cities.md).
**Elements:** "Where do you work?" prompt, **Detected** card (populated from Vercel IP geolocation headers — hidden if detection fails), **Search** card that expands into a debounced live-search input over the Open-Meteo geocoding API (proxied via `/api/onboarding/cities`), Back + Continue buttons, progress indicator (3 of 4). No preset cards, no "Somewhere else" affordance, no "Nominate your city" link — every city is in scope.
**Storage:** `profiles.market` is free text in the format `"City, Region, Country"` (e.g. `"Toronto, Ontario, Canada"`). Identical shape from both Detected and Search paths.

### 2.4 Onboarding — Plan
**Purpose:** Choose Free (default) or upgrade to Pro at onboarding time.
**Elements:**
- Heading: "Start free. Upgrade when you're ready to share."
- Free card (selected by default) — $0 forever, full app access, exports locked
- Pro card — $29/mo billed annually (Save 30% badge) / $37 monthly, unlocks PDF exports + shareable client links
- Info chip: "You can upgrade, downgrade, or cancel any time from Settings."
- Back + primary CTA — label adapts: **"Continue with Free"** when Free is selected, **"Continue to checkout"** when Pro is selected
- Progress indicator (4 of 4)

**Post-step:**
- Free → Free Welcome screen (§2.5)
- Pro → Checkout (§2.6) → Pro Success (§2.7)

### 2.5 Free Welcome
**Purpose:** Handoff screen that confirms Free is active and points at the first action.
**Elements:** "Free · Active" eyebrow, headline "Start your first project", Pro upsell strip, primary CTA "Create your first project" → `/projects/new`.

### 2.6 Checkout (Pro path)
**Purpose:** Take payment inline with Speclyy's brand (see [ADR-0018](architecture/adr/0018-payment-surface.md)).
**Elements:** Embedded Stripe `PaymentElement` (card, expiry, CVC, name, country, ZIP), "Save card for future billing" checkbox, primary CTA "Pay ${total} and activate Pro", "Secured by Stripe" note. Right pane: order summary with plan row, annual discount callout, "Due today" total, renewal copy.

### 2.7 Pro Success
**Purpose:** Confirm activation post-payment.
**Elements:** "Pro · Activated" eyebrow, headline "You're all set up.", receipt card (Plan / Next billed / Receipt #), "View receipt" + "Open your workspace" CTAs → `/projects`.

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
| 1.2 | Sign-In — Verify code | Auth |
| 2.1 | Onboarding — Name | Onboarding |
| 2.2 | Onboarding — Studio | Onboarding |
| 2.3 | Onboarding — Market | Onboarding |
| 2.4 | Onboarding — Plan | Onboarding |
| 2.5 | Free Welcome | Onboarding |
| 2.6 | Checkout (Pro path) | Onboarding / Billing |
| 2.7 | Pro Success | Onboarding / Billing |
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
