# Scraper Performance

The scraper is Speclyy's core differentiator over Programa. If it's slow or unreliable, designers won't switch. This document covers every lever for reducing wait time and improving perceived speed.

---

## Time breakdown (baseline, no optimisations)

| Stage | Time | Reducible? |
|---|---|---|
| Playwright cold start (new browser) | 3–8s | ✅ Eliminated by pool |
| Page navigation + anti-bot delay | 3–12s | Partial — stealth helps |
| Claude API extraction | 2–8s | Partial — Sonnet vs Opus |
| Image re-hosting | 0.5–2s | No |
| **Total (cold)** | **8–30s** | |
| **Total (warm pool)** | **5–22s** | |
| **Total (cache hit)** | **~100ms** | |

The cold start and cache are the two biggest wins. Everything else is noise.

---

## Strategy 1 — Browser pool (always-warm Playwright pages)

Instead of launching a new browser per request, keep a pool of idle, ready-to-navigate pages on the Fly.io container.

```ts
// scraper/lib/browser-pool.ts
import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import type { Page, Browser } from 'playwright'

chromium.use(StealthPlugin())

class BrowserPool {
  private browser: Browser | null = null
  private pool: Page[] = []

  private readonly MIN_WARM = 2   // always keep this many idle pages ready
  private readonly MAX_POOL = 6   // never hold more than this

  async init() {
    this.browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })
    await this.refillPool()
    console.log(`[pool] initialised — ${this.pool.length} warm pages ready`)
  }

  async acquire(): Promise<Page> {
    if (this.pool.length > 0) {
      const page = this.pool.pop()!
      this.refillPool()   // async replenish — don't wait for it
      return page
    }
    // Pool exhausted under burst — create on-demand (slower path)
    console.warn('[pool] exhausted — creating on-demand page')
    return await this.browser!.newPage()
  }

  async release(page: Page) {
    try {
      await page.goto('about:blank', { timeout: 3000 })
      await page.context().clearCookies()
      if (this.pool.length < this.MAX_POOL) {
        this.pool.push(page)
      } else {
        await page.close()
      }
    } catch {
      // Page is broken — close it; refill will replace it
      await page.close().catch(() => {})
      this.refillPool()
    }
  }

  private async refillPool() {
    while (this.pool.length < this.MIN_WARM) {
      try {
        const page = await this.browser!.newPage()
        await page.goto('about:blank', { timeout: 5000 })
        this.pool.push(page)
      } catch (e) {
        console.error('[pool] refill error:', e)
        break
      }
    }
  }

  get size() { return this.pool.length }
}

export const playwrightPool = new BrowserPool()

// Called once at server startup (server.ts)
// await playwrightPool.init()
```

**Impact:** Playwright cold start drops from 3–8s → ~0.5s. Every single scrape benefits.

**Memory:** Each warm page holds ~80–100MB. Pool of 4 = ~400MB. Fly.io instance at 1GB RAM has headroom for pool + Node process.

---

## Strategy 2 — Activity-triggered pre-warm

When a designer becomes active, top up the pool before they paste their first URL. By the time they paste, there's zero cold start.

### Trigger points

| Signal | Action |
|---|---|
| Designer signs in | `POST /internal/warm` → ensure ≥ 2 ready pages |
| Project opened | `POST /internal/warm` → top up to 4 |
| Designer idle > 30 min | Pool drains passively to MIN_WARM (memory savings) |

### Next.js → Fly.io warm signal

```ts
// app/(app)/projects/[id]/page.tsx (RSC)
// Fire-and-forget — don't await, don't block render
fetch(`${process.env.SCRAPER_INTERNAL_URL}/internal/warm`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.SCRAPER_INTERNAL_KEY}` },
}).catch(() => {})   // silently ignore if scraper is restarting
```

```ts
// scraper/routes/internal.ts
app.post('/internal/warm', authenticate, async (req, res) => {
  const target = req.body?.target ?? 4
  const current = playwrightPool.size
  if (current < target) {
    playwrightPool.refillPool(target)   // async, don't block
  }
  res.json({ poolSize: playwrightPool.size, target })
})
```

**Cost:** ~0.5s of CPU on the Fly.io instance per page pre-warm. Negligible.

---

## Strategy 3 — Cache flywheel (the biggest long-term lever)

Every bulk crawl pre-populates `scrape_cache` with that brand's entire catalog. When a designer pastes any URL from that brand, it's an instant cache hit (~100ms) rather than a live scrape.

```
Bulk crawl Delta 1,200 products
  → 1,200 scrape_cache rows with status = 'success'

Designer pastes deltafaucet.com/product/T14094-I
  → url_hash match in scrape_cache
  → instant prefill, 0 Playwright, 0 Claude cost
```

**Priority for bulk crawls:** rank by designer URL paste frequency. If the Axiom logs show 40% of on-demand scrapes are `deltafaucet.com`, that domain should be the first bulk crawl target.

```kusto
// Which domains are designers pasting most? (Axiom)
['speclyy-scraper']
| where mode == "on_demand" and _time > ago(30d)
| summarize count = count() by domain
| order by count desc
| take 10
```

---

## Strategy 4 — Popular URL cache refresh

Some product pages change (price, availability, new finishes). Track which URLs are hit repeatedly by different designers and re-scrape them on a rolling window.

```ts
// cron: weekly
// Find on-demand scrape_cache entries hit by ≥ 3 distinct users in the last 30 days
// where last scraped > 7 days ago
// → re-queue for background refresh
SELECT url_hash, url, count(distinct user_id) as user_count
FROM scrape_requests_log   -- lightweight event log
WHERE created_at > now() - interval '30 days'
GROUP BY url_hash, url
HAVING count(distinct user_id) >= 3
  AND url_hash IN (
    SELECT url_hash FROM scrape_cache
    WHERE status = 'success' AND created_at < now() - interval '7 days'
  )
```

This keeps the most-used products fresh without scraping every entry in the cache.

---

## Strategy 5 — Progressive field streaming (perceived speed)

Even if the scrape takes 12s, we can make it *feel* faster by showing fields as they arrive rather than all at once.

```
T+0s    Item row appears (URL hostname as placeholder name)
T+4s    Brand + product_name appear (Claude output starts streaming)
T+7s    Finish, SKU fill in
T+10s   Dimensions appear
T+12s   Thumbnail loads (CDN latency, often the last thing)
```

Claude returns JSON, which can't be streamed field-by-field natively. Two options:

**Option A (simpler):** Claude returns the most important fields first in a streaming response; Next.js parses partial JSON and populates as tokens arrive.

**Option B (practical for MVP):** Claude returns complete JSON in one shot, but we *animate* the field population client-side — stagger the appearance of each field by 200–300ms. Designer perceives fields "loading in" even though the response arrived at once. Cheap to implement.

Option B ships at MVP. Option A is a future enhancement.

---

## Priority order

| Priority | Strategy | Effort | Impact |
|---|---|---|---|
| **P0** | Browser pool (always-warm pages) | 1 day | −4s off every cold scrape |
| **P0** | Failure inline edit + retry UX | 2 days | Failures don't block designers |
| **P1** | Activity-triggered pre-warm | 0.5 days | Near-zero cold start for active sessions |
| **P1** | Bulk crawl as cache pre-warming | Already designed | Instant for popular brands |
| **P2** | Popular URL refresh cron | 1 day | Popular products stay fresh |
| **P2** | Progressive field animation | 0.5 days | Perceived speed improvement |

P0 before first designer onboarded. P1 before 10 designers. P2 post-validation.

---

## References

- [on-demand.md](on-demand.md) — async UX, failure UX, Inngest step isolation
- [failure-tracking.md](failure-tracking.md) — diagnosing which domains are slow/blocked
- [ADR-0010](../adr/0010-scraper-host.md) — why Fly.io persistent container (pool lives for machine lifetime)
- [ADR-0011](../adr/0011-job-queue.md) — Inngest concurrency and step isolation
