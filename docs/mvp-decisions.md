# MVP Decisions

Locked decisions from the MVP scoping session. These are inputs to the screen inventory, user flows, and design.

---

## 1. Auth
**Google OAuth only.**
No email/password for MVP. Single sign-in method keeps implementation simple and removes password management overhead.

---

## 2. URL Paste Behaviour
**AI scrape with best-effort prefill (with fallback).**
When a designer pastes a product URL, the system attempts to extract: product name, brand, image, SKU, finish options, dimensions, and link. All fields are editable after prefill. If scraping fails, falls back to a blank editable form. This is the core differentiator — no scrape = no product.

---

## 3. Seed Data Scope
**Demo-ready slice first, quality catalog second.**
MVP ships with just enough data to make the 5 must-win workflows work (e.g. Kohler Billet collection fully seeded, a few representative products per brand). Post-validation, expand to a thin but complete catalog (50–200 products per brand, every entry with full data).

**MVP inventory coverage:**
- Plumbing: Delta, Brizo, Kohler
- Paint: Sherwin-Williams, Benjamin Moore
- Markets: Los Angeles, New York, Dallas, Calgary

---

## 4. Business Model
**Open beta + freemium (Free + Pro).**
- Anyone can sign up (no waitlist, no invite codes)
- Free plan: full app access — create projects, build specs, use the product library. PDF export is gated (blurred preview shown so the designer sees exactly what they're unlocking).
- Pro plan: unlocks PDF export + shareable link export. Two billing intervals: monthly ($37/mo) or annual ($29/mo billed yearly — 30% off).
- Promo codes available to grant Pro access for a defined period (e.g. community partnerships, influencer campaigns)

---

## 5. Export
**Branded PDF spec sheet only.**
- Single export format: PDF
- Format: branded spec sheet (room sections, product images, name, brand, finish, SKU, link, notes)
- Speclyy-branded template for MVP
- Designer's own logo/studio branding: post-MVP
- CSV export: post-MVP
- Draft exports always allowed (missing fields shown as TBD, not blocking)

---

## 6. My Library
**Skipped for MVP — first post-MVP feature.**
Designers can save/reuse products across projects. Not in scope for MVP launch. Prioritised immediately after MVP is validated.

---

## 7. Pricing
**Two plans: Free and Pro.**

| | Free | Pro |
|---|---|---|
| Projects & specs | Unlimited | Unlimited |
| URL → spec extraction | Yes | Yes |
| Product library | Yes | Yes |
| PDF export | Blurred preview (upgrade prompt) | Full download |
| Shareable link export | No | Yes |
| Price | $0 | $37/mo or $29/mo billed annually (30% off) |

- Promo codes grant Pro access for a defined period

---

## 8. Platform
**Web app, responsive from day 1.**
No native mobile app. Responsive design is a launch requirement, not a post-MVP addition.

---

## 9. Tech Stack
**TBD — dedicated session required.**
Building solo initially, one additional dev joining as needed. Tech stack decisions (frontend framework, backend, database, hosting) to be locked in a separate session.

---

## 10. Onboarding
**2–3 screen onboarding flow on first sign-in.**
After Google sign-in, new users go through a short setup before reaching the dashboard:
1. Your name
2. Studio name
3. Market (Los Angeles / New York / Dallas / Calgary)

Then: dashboard with empty state + "Create your first project" prompt. No trial period — free plan is indefinite. Designers use the full app for free and hit the paywall only when they try to export a PDF (shown a blurred preview with an upgrade prompt). They then choose monthly ($37) or annual ($29/mo billed yearly) in Stripe Checkout.
