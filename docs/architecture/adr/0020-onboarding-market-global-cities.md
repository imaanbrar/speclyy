# ADR-0020: Onboarding market — global city search instead of curated launch markets

- **Status:** Accepted
- **Date:** 2026-04-26
- **Supersedes:** the market-related decisions in [ADR-0016](0016-onboarding-data-model-revision.md) — specifically the "curated launch markets (`los_angeles`, `new_york`, `dallas`, `calgary`) plus 'Somewhere else'" UX. The free-text storage decision from 0016 is preserved (and is now the only path).

## Context

[ADR-0016](0016-onboarding-data-model-revision.md) dropped the `profiles.market` CHECK constraint and settled on free-text storage, but the surface design kept four preset launch markets (Los Angeles / New York / Dallas / Calgary) plus a "Somewhere else" free-text card and a "Nominate your city →" link. That UX shipped no code; when implementing TASK-ONB-04 the design choice surfaced three problems:

1. **The preset cards advertise "we don't serve you yet"** to every designer outside those four cities. A user in London or Toronto sees four North American cards plus a fallback before they can type — the card list signals scope before the picker does any work.
2. **The picker conflated two concerns.** "Where does the designer practice?" is a profile fact about the user. "Which cities have curated local supplier inventory?" is a Library/operations concern owned by `global_products.markets`. Tying the onboarding picker to the Library coverage list means every market we add later requires a UI deploy, and every city we *don't* add looks like a downgrade in the picker.
3. **"Nominate your city" was vestigial.** With free-text storage already accepted, no nomination is required — the user types whatever city they're in and the profile stores it. The link was reassurance UX for a problem the schema no longer has.

Designers practice in every city. The product vision is global from day one (per the multi-app architecture in [ADR-0019](0019-multi-app-architecture.md)). A market picker that looks like an LA-first US tool is the wrong first impression for everyone outside that slice.

## Decision

### Onboarding market step is a global city search

The screen offers two affordances, no preset cards:

1. **Detected card** — populated from the request's IP geolocation (Vercel edge headers `x-vercel-ip-city`, `x-vercel-ip-country-region`, `x-vercel-ip-country`). One-click select. If detection fails (header missing, e.g. localhost or VPN), the card is hidden — only search is offered.
2. **Search card** — expands into a debounced (300 ms) live-search input. Results come from the [Open-Meteo geocoding API](https://open-meteo.com/en/docs/geocoding-api) via an authenticated proxy at `/api/onboarding/cities?q=…`. Selecting a result populates the hidden `market` field.

No "Nominate your city" link, no "Somewhere else" card, no preset cards. There is no list of curated launch markets visible in the onboarding UI.

### Storage format

`profiles.market` stays free text and stores `"City, Region, Country"` — e.g. `"Atherton, California, United States"`, `"Toronto, Ontario, Canada"`, `"London, England, United Kingdom"`. ISO 3166-1 alpha-2 country codes from Open-Meteo are expanded to display names via `Intl.DisplayNames` before storage. Validation: `z.string().trim().min(1).max(120)`.

### Geocoding provider — Open-Meteo

Open-Meteo's geocoding API is free, requires no API key, and returns `{ name, admin1, country, country_code, latitude, longitude }` per result. The `/api/onboarding/cities` route is auth-gated, accepts `?q=…` (min 2 chars), proxies the upstream call, normalises results to `{ id, label }[]`, and caches with `Cache-Control: private, max-age=60, s-maxage=300`.

### Detection provider — Vercel edge headers

The market page reads `x-vercel-ip-city` (URL-encoded — `+` is decoded to space), `x-vercel-ip-country-region`, and `x-vercel-ip-country` from the request headers. Combined into the same `"City, Region, Country"` label format as search results, so the storage shape is invariant to which path the user took. No browser geolocation API call — the permission prompt mid-onboarding measurably hurts conversion and the precision is unnecessary for a profile fact.

### Library coverage stays decoupled

`global_products.markets text[]` (in [database.md](../database.md)) keeps tagging which curated local-supplier inventory applies in which cities. That column is unrelated to onboarding — it is filled and queried by the Library code path, not the onboarding picker. Speclyy can add or remove curated inventory for any city without touching this onboarding flow, and a designer picking a city we don't have curated inventory for still gets the global-brand catalog and URL/manual entry.

## Rationale

**A global tool needs a global picker.** Any preset list draws a line; the line will always exclude someone, and the line is always re-drawable as we expand. A search input draws no line — every city is in scope by construction.

**Detection + search beats a list.** Most users live in a recognisable city; detection nails the common case in zero clicks. Search handles VPN users, edge-case cities, and disagreement-with-detection cases. A list as a third surface adds a step for everyone.

**IP detection over browser geolocation.** Vercel's edge headers are zero-cost, zero-prompt, and accurate enough for a profile field. Browser geolocation requires a permission dialog mid-onboarding — friction we can't justify for the precision we don't need.

**Open-Meteo over Google Places for v1.** No API key, no billing setup, generous rate limits, and city/admin1/country is exactly the shape we want. If quality becomes a problem (typos not handled well, missing cities), we revisit; the API contract stays the same.

**Decouple onboarding from Library coverage.** Tying the two together means the onboarding flow gets a UI change every time supplier coverage changes. Keeping them separate lets supplier seeding be an internal data operation that ships without a deploy, and lets the picker surface stay constant as the catalog grows.

**Free-text format `"City, Region, Country"`.** Stable across detection and search paths (same shape regardless of provider), human-readable on the profile screen and on PDF spec sheets, and tractable for future fuzzy matching against curated coverage lists.

## Consequences

**Positive**
- One less UX iteration when a fifth, sixth, … N-th launch market is added.
- Designers outside the original four cities have a first-class experience instead of "Somewhere else."
- Library supplier seeding becomes a data-only change with no impact on onboarding.
- Storage format is invariant to detection vs. search source — downstream code never branches on which path the user took.
- "Nominate your city" disappears — there's nothing to nominate.

**Negative**
- Profile-derived analytics ("how many designers in LA?") now require fuzzy matching against free text rather than aggregating on a constrained set of slugs. Acceptable — this is an analytics concern, not a UX one.
- Adds an external dependency (Open-Meteo) on the onboarding path. Mitigation: the API has no key + 10k req/day generous limit; if it goes down, the search card surfaces a graceful "couldn't find that city" state and the user can still complete onboarding using the detected card. If detection also fails, the form can be unblocked with any typed string ≥ 1 char (we already validate length, not shape).
- IP detection mislabels VPN users; they correct via search. Acceptable — search is one keystroke.

## Alternatives considered

- **Keep four preset cards, expand "Somewhere else" into a search.** Rejected. UX double-think for the majority of users who are already "Somewhere else." Adds a click for the same outcome.
- **Curated allow-list of ~200 major global cities.** Rejected. Drawing the cutoff is arbitrary; lists become political ("why is X on but Y off?"); maintenance overhead. Search is neutral.
- **Browser `navigator.geolocation` for detection.** Rejected. Permission prompt hurts onboarding conversion; precision is unnecessary for a profile field.
- **Google Places Autocomplete.** Deferred. Better quality but requires a billing-enabled API key and per-keystroke cost. Open-Meteo is adequate for v1; revisit if quality complaints surface.
- **Mapbox Geocoding API.** Deferred for the same reason — requires keyed access. Open-Meteo's free tier wins for v1.
- **Skip the market step entirely.** Rejected. Studio location appears on PDF spec sheets and seeds future local-supplier surfacing in the Library; collecting it once at onboarding is cheaper than asking later.

## Implementation pointers

- API route: [`apps/web/src/app/api/onboarding/cities/route.ts`](../../../apps/web/src/app/api/onboarding/cities/route.ts) — auth-gated Open-Meteo proxy.
- Picker: [`apps/web/src/app/(onboarding)/onboarding/market/_components/market-picker.tsx`](../../../apps/web/src/app/(onboarding)/onboarding/market/_components/market-picker.tsx) — Detected card + Search card + listbox.
- Label helper: [`apps/web/src/app/(onboarding)/onboarding/market/_lib/city-label.ts`](../../../apps/web/src/app/(onboarding)/onboarding/market/_lib/city-label.ts) — joins parts and expands ISO country codes via `Intl.DisplayNames`.
- Page (reads Vercel headers): [`apps/web/src/app/(onboarding)/onboarding/market/page.tsx`](../../../apps/web/src/app/(onboarding)/onboarding/market/page.tsx).
- Server Action: [`apps/web/src/app/(onboarding)/onboarding/market/actions.ts`](../../../apps/web/src/app/(onboarding)/onboarding/market/actions.ts) — trims, length-validates, writes `profiles.market`.

## References

- [ADR-0016](0016-onboarding-data-model-revision.md) — free-text market column (storage decision preserved; preset-card UX superseded here)
- [ADR-0019](0019-multi-app-architecture.md) — multi-app context that motivates a globally-scoped picker
- [`../database.md`](../database.md) — `profiles.market` column (no CHECK), `global_products.markets` (Library coverage tagging)
- [`../../implementation-tasks/onboarding/TASK-ONB-04-step-3-market.md`](../../implementation-tasks/onboarding/TASK-ONB-04-step-3-market.md) — task spec reflecting this decision
