---
id: TASK-ONB-04
title: Step 3 · Market — global city search with IP-geo detection
group: onboarding
status: ready
estimate: 3
dependencies: [TASK-ONB-03]
related_screens: ["2.3 Onboarding · Market — detected", "2.3b Onboarding · Market — search"]
related_adrs: [ADR-0016, ADR-0020]
created: 2026-04-22
updated: 2026-04-26
---

# TASK-ONB-04 — Step 3 · Market

## Goal

Capture the designer's market as **any city in the world**. There are no preset markets — every city is equally valid. We seed the screen with a city detected from the request's IP (Vercel edge headers) so most users can confirm with one click; if the detected city is wrong or absent, the user opens a search field that auto-completes against a global geocoding service.

## Scope

**In scope**
- Route: `apps/web/src/app/(onboarding)/onboarding/market/page.tsx`.
- Server-side IP-geo detection from Vercel headers (`x-vercel-ip-city`, `x-vercel-ip-country-region`, `x-vercel-ip-country`). When present, render a "Detected" card pre-selected.
- **Search** card → reveals a typeahead search input. Results fetched from `/api/onboarding/cities?q=…` (a thin Next.js Route Handler that proxies the Open-Meteo geocoding API — free, no key, returns up to N city/region/country tuples).
- Server Action `saveMarket(value)` that updates `profiles.market` with the chosen string.
- Back → `/onboarding/studio`. Continue → `/onboarding/plan`.
- Storage format: `"City, Region, Country"` (e.g. `"Vancouver, British Columbia, Canada"`). For the detected card, the same format is constructed from the headers. Free text from the search results means we keep whatever shape the API returned, lightly normalized.

**Out of scope**
- Geocoordinates / lat-lng on the profile — not needed; `profiles.market` is human-readable only.
- Browser `navigator.geolocation` permission prompt — IP-based detection is good enough for the seed and avoids a permission prompt mid-onboarding.
- Self-hosting a city dataset — the geocoding proxy is acceptable for v1; if rate limits bite we can swap providers without changing this UI.
- City-based pricing or feature gating — out of scope; this field is advisory.

## Acceptance criteria

```gherkin
Scenario: Detected city — confirm
  Given Vercel headers report city = "New York", region = "New York", country = "US"
  When I land on /onboarding/market
  Then the Detected card is rendered with "New York" selected
  When I click Continue
  Then profiles.market = 'New York, New York, United States'
  And I am redirected to /onboarding/plan

Scenario: No detection
  Given Vercel headers carry no city (local dev / privacy proxy)
  When I land on /onboarding/market
  Then no Detected card renders, and the search panel is the primary affordance

Scenario: Search and pick
  Given I open the search panel
  When I type "van" and click "Vancouver, British Columbia, Canada"
  And I click Continue
  Then profiles.market = 'Vancouver, British Columbia, Canada'
  And I am redirected to /onboarding/plan

Scenario: Search returns nothing
  Given I type "asdfqwer" and the API returns 0 hits
  Then the panel shows "No cities matched. Try a different spelling."
  And the Continue button stays disabled until something is selected

Scenario: Revisit
  Given my profile already has market = 'Vancouver, British Columbia, Canada'
  When I navigate back to /onboarding/market
  Then the search panel is open with that value preselected (or the Detected card if it matches the stored value)

Scenario: Both fields trim
  Given the typed search value or detected header has surrounding whitespace
  Then the stored market is trimmed and collapsed to single spaces
```

## Architecture references

- [`../../architecture/auth.md`](../../architecture/auth.md) § "Data model" — `profiles.market` is free text; no CHECK constraint.
- [ADR-0016 — Onboarding data model revision](../../architecture/adr/0016-onboarding-data-model-revision.md) — rationale for free-text storage.
- [ADR-0020 — Onboarding market: global city search](../../architecture/adr/0020-onboarding-market-global-cities.md) — **authoritative for this task's UX**: no preset cards, IP detection + Open-Meteo search, `"City, Region, Country"` storage shape.
- [`../../implementation-tasks/onboarding/_source-plan.md`](_source-plan.md) § "Decisions (confirmed)" — free-text market, "Continue" CTA. Preset cards are dropped per 2026-04-26 product decision (see same file).

## Implementation notes

- **Header read** is a one-liner in the page Server Component:
  ```ts
  const h = await headers()
  const detected = {
    city:    h.get('x-vercel-ip-city')?.replace(/\+/g, ' ') ?? null,
    region:  h.get('x-vercel-ip-country-region') ?? null,
    country: h.get('x-vercel-ip-country') ?? null,
  }
  ```
  Vercel URL-encodes city names with `+` for spaces — decode before display. On localhost these are absent; the page must not error.
- **Geocoding proxy** at `apps/web/src/app/api/onboarding/cities/route.ts`:
  - GET `?q=<query>` (min 2 chars).
  - Calls `https://geocoding-api.open-meteo.com/v1/search?name=<q>&count=8&language=en&format=json`.
  - Returns `{ results: { id, city, region, country, label }[] }`. `label = "City, Region, Country"` with empty parts elided.
  - 5-minute `Cache-Control: public, s-maxage=300` to keep traffic low.
  - Auth-gated: only authenticated users can hit it (rate-limit by user when we add a limiter; for now, auth is the gate).
- **Country code → name.** Open-Meteo returns 2-letter ISO codes. Use `Intl.DisplayNames(['en'], { type: 'region' })` server-side to render full names.
- **Client component** (`_components/market-picker.tsx`) handles the search input, debounces (300 ms), calls the proxy, and renders the result list. Selecting a result fills a hidden form field and enables Continue. The `<form action={saveMarket}>` wrapper is in the server page so JS-disabled users can still see the Detected card and pick it.
- **Validation:**
  ```ts
  const Market = z.string().trim().min(1).max(120)
  ```
- **Server Action** is a single `UPDATE profiles SET market = $1, updated_at = now() WHERE id = auth.uid()`.

## Review notes

- **No canonicalization.** Reviewer: confirm we don't lowercase or strip diacritics — the product decision is to store what was selected (or in the Detected case, the human-readable form built from headers).
- **Don't reintroduce a CHECK constraint.** Earlier ADRs had a market CHECK; explicitly dropped in ADR-0016.
- **Max length 120.** "City, Region, Country" comfortably fits; pathological inputs are bounded.
- **Cache the proxy response.** s-maxage=300 is enough — these queries are typed live; 5 minutes is fine for autocomplete.
- **Open-Meteo is the v1 provider; not contractual.** If it goes down or rate-limits, swap inside the route handler. The DB shape doesn't change.
- **Accessibility:** the two cards are a radio group (`role="radiogroup"`); the search list is `role="listbox"` with `aria-activedescendant` and arrow-key navigation.
- **No preset list.** Reviewer: if anyone proposes hard-coding "LA / NYC / Dallas / Calgary" again, point them at this task and [ADR-0020](../../architecture/adr/0020-onboarding-market-global-cities.md).

## Test plan

- **Unit:** `Market` schema accepts trimmed city strings, rejects empty / overlong.
- **Unit:** `buildLabel({ city, region, country })` — happy path, missing parts, ISO-code → display-name conversion.
- **Integration:** Route Handler GET `/api/onboarding/cities?q=van` returns ≥1 result; query under 2 chars returns 400.
- **Manual:** local dev (no Vercel headers) → only the search panel renders.
- **Manual:** prod-like (set `x-vercel-ip-city: Vancouver`, `x-vercel-ip-country-region: BC`, `x-vercel-ip-country: CA`) → Detected card pre-selects "Vancouver, British Columbia, Canada".
- **E2E coverage** ships in [TASK-TEST-03](../testing/TASK-TEST-03-onboarding-e2e-suite.md).

## Open questions

- None. Open-Meteo is the v1 geocoding provider; revisit if free-tier limits become an issue.
