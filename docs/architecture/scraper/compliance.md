# Scraper Compliance Policy

Single source of truth for how the Speclyy scraper interacts with third-party websites — User-Agent, robots.txt handling, vendor ToS denylist, takedown process, and ownership.

Scraping is a legal grey area. This policy defines where we land in that grey area and how we stay defensible.

---

## Principles

1. **Designer intent is the strongest signal.** A designer pasting a URL is an explicit, user-directed action — we treat it like a browser fetch, not an automated crawl.
2. **Bulk crawl is automated and must be conservative.** Admin-triggered catalog crawls honour robots.txt, rate limits, and identify themselves.
3. **Respect contract, not just convention.** Some vendors prohibit automated access in ToS even when robots.txt is permissive. Those go on an explicit denylist.
4. **Be reachable and responsive.** Vendors who want us to stop can find us (User-Agent URL) and get a response within 72h.

---

## User-Agent

Every outbound request from the scraper sends:

```
User-Agent: Speclyy/1.0 (+https://speclyy.com/scraper)
```

The URL resolves to a short page describing what the scraper is, how to contact us, and how to request takedown. Never spoof a browser UA — stealth plugins patch fingerprints at the browser level (see [on-demand.md — Playwright stealth config](on-demand.md)) but the advertised UA is always ours.

---

## robots.txt handling

### On-demand (designer-pasted URL) — NOT checked

A designer pasting a URL is a user-directed action; we do not gate user-directed fetches on robots.txt. A browser wouldn't. This matches how every product-preview feature on the web behaves (Slack unfurls, iMessage link previews, Notion embeds).

### Bulk crawl — honoured strictly

Before discovery inserts any URL into `crawl_urls`, the scraper fetches `/robots.txt` and drops paths disallowed for our User-Agent. A domain with `respectRobots: false` in `scraper/config/domains.ts` bypasses this check; that flag is only set when we have **written permission from the vendor** and a note in the domain config recording who granted it and when.

---

## ToS denylist — the real compliance lever

Robots.txt is advisory. ToS is contractual. Several categories of vendor prohibit automated access in ToS even with a generous robots.txt:

- Luxury fashion houses (many include "no automated access" clauses)
- Some ateliers and bespoke furniture makers
- Auction houses (Sotheby's, Christie's — separate listing rights)
- Enterprise B2B catalogs with login-gated pricing

Designers in the interior-design space paste from all of these categories occasionally. We maintain an explicit denylist.

### The blocked-domains module

```ts
// scraper/config/blocked-domains.ts
//
// Domains whose ToS explicitly prohibits automated access.
// Owner: ops@speclyy.com. Reviewed quarterly.
// Last review: YYYY-MM-DD (seed — replace with legal review results)

export interface BlockedDomain {
  domain: string        // hostname without "www."
  reason: string        // one-liner shown in logs + user-facing UX
  tosUrl: string        // direct link to the prohibiting ToS clause
  reviewedAt: string    // ISO date of the last human review
  reviewedBy: string    // initials of the reviewer
}

export const BLOCKED_DOMAINS: BlockedDomain[] = [
  // Populate from legal review. Example shape:
  // {
  //   domain: 'example-luxury-brand.com',
  //   reason: 'Automated access prohibited under §4 of Terms of Use',
  //   tosUrl: 'https://example-luxury-brand.com/terms#section-4',
  //   reviewedAt: '2026-04-22',
  //   reviewedBy: 'VT',
  // },
]

const index = new Map(BLOCKED_DOMAINS.map(d => [d.domain, d]))

export function isBlocked(hostname: string): BlockedDomain | null {
  const normalized = hostname.toLowerCase().replace(/^www\./, '')
  return index.get(normalized) ?? null
}
```

### Seeding the list

Before the first production scrape, a one-pass legal review of the **top ~30 domains** we expect designers to paste. Ranked by pasting frequency once we have data; seeded from the Programa/Studio Designer competitive analysis and designer interviews until then. Add a new row every time Axiom surfaces a domain that should have been blocked — the list grows with observed traffic.

### Review cadence

- **Quarterly** — owner audits the denylist: verify tosUrl still points at the quoted clause, remove domains whose ToS has changed, add any new ones flagged during the quarter.
- **On-demand** — any designer report, any vendor email, any legal notice triggers an immediate review of the relevant domain.

---

## Enforcement point

Both scrape modes call `isBlocked()` **before** any network activity. A blocked domain fails fast with `error_type = 'tos_blocked'` — no Playwright, no Claude, no rehost, no cost.

### On-demand

```ts
// scraper/functions/scrape-url.ts — pre-flight check, runs before Playwright step
const block = isBlocked(new URL(url).hostname)
if (block) {
  await recordFailure(urlHash, 'tos_blocked', block.reason)
  await db.update(projectItems).set({
    scrapeStatus: 'failed',
    // Item row stays in place with the URL so the designer can reference the source.
  }).where(eq(projectItems.id, itemId))
  return { blocked: true, reason: block.reason }
}
```

### Bulk crawl

The discovery step drops blocked domains entirely — they never make it into `crawl_urls`. A follow-up log event to Axiom lets the admin see the skip:

```ts
await axiom.ingest('speclyy-scraper', [{
  service: 'scraper',
  mode: 'bulk_crawl',
  event: 'crawl_rejected_tos',
  domain,
  reason: block.reason,
}])
```

---

## User-facing UX for `tos_blocked`

Distinct from the generic failure UX ([on-demand.md — Failure UX](on-demand.md)) — retry would be meaningless, so the button set is different:

```
┌──────────────────────────────────────────────────────────────┐
│  🚫 This vendor doesn't permit automated product capture     │
│     hermes.com/us/en/product/...                             │
│                                                              │
│  Please enter the details manually — we'll save them to      │
│  your spec with the original URL as a reference.             │
│                                                              │
│  [ ✎ Fill in manually ]   [ ↗ Open in new tab ]              │
└──────────────────────────────────────────────────────────────┘
```

- **No "Try again"** — retrying changes nothing, and we don't want to encourage designers to paste the URL twice.
- **Item row stays in place** with `status = 'tbd'` and the original URL preserved.
- The copy is blame-neutral (the vendor's policy, not a failure on our side).

---

## Takedown process

Any vendor can request removal by emailing `takedowns@speclyy.com` (or via the scraper UA URL). The response SLA is:

| Step | Target | Owner |
|---|---|---|
| Acknowledge receipt | Within 24h | ops |
| Remove `scrape_cache` rows for the domain | Within 48h | eng |
| Remove re-hosted images from Supabase Storage | Within 48h | eng |
| Add domain to `BLOCKED_DOMAINS` | Within 72h | ops |
| Confirm completion to vendor | Within 72h | ops |

Takedown is a one-way action — once a domain is blocked, removing it requires a documented permission grant from the vendor (written email, countersigned agreement, etc.) stored in `docs/legal/`.

---

## Ownership

| Responsibility | Owner |
|---|---|
| Maintains `BLOCKED_DOMAINS` list | ops@speclyy.com |
| Quarterly review | ops, with eng support for Axiom queries |
| Responds to takedown emails | ops |
| Implements new domain blocks in code | eng |
| Final sign-off on `respectRobots: false` overrides | ops + eng jointly |

This policy is reviewed at the same cadence as the denylist itself — quarterly, or on any legal/vendor incident.

---

## References

- [on-demand.md](on-demand.md) — Playwright stealth config, failure UX
- [bulk-crawl.md](bulk-crawl.md) — robots.txt handling during discovery
- [failure-tracking.md](failure-tracking.md) — `tos_blocked` in the error taxonomy
- [../security.md](../security.md) — scraped-content retention, takedown handling
- [../database.md](../database.md) — `scrape_cache.error_type` enum
