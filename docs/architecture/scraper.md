# AI Scraper — Architecture

How the URL-to-product extraction pipeline works. This is Speclyy's core differentiator — "paste a URL, get prefilled fields."

> ADRs 0010–0014 are now locked. See [adr/](adr/) for decisions on scraper host, job queue, extraction strategy, bulk crawl design, and log store.

---

## Overview

```mermaid
sequenceDiagram
  participant D as Designer
  participant NA as Next.js (Vercel)
  participant INN as Inngest
  participant SC as Scraper (Fly.io)
  participant PW as Playwright
  participant AI as Claude API
  participant DB as Supabase DB
  participant ST as Supabase Storage

  D->>NA: Paste URL + click Fetch
  NA->>DB: Check scrape_cache (url_hash)
  alt Cache hit
    DB-->>NA: Return cached extracted_data
    NA-->>D: Prefill form instantly
  else Cache miss
    NA->>DB: Insert scrape_cache (status: pending)
    NA->>INN: Emit scrape.requested event
    NA-->>D: Show "Fetching..." spinner
    INN->>SC: Trigger scrape job
    SC->>PW: Launch browser, load URL
    PW-->>SC: HTML + screenshot
    SC->>AI: Extract fields from HTML
    AI-->>SC: Structured JSON
    SC->>ST: Upload re-hosted product image
    SC->>DB: Update scrape_cache (status: success, extracted_data)
    SC->>INN: Emit scrape.completed event
    INN->>NA: Callback → revalidate item
    NA-->>D: Prefill form with extracted fields
  end
```

---

## Why this must be a separate service

Three constraints force the scraper off Vercel:

1. **Vercel has a 300s max function timeout.** Playwright sessions can take 5–60s. More importantly, anti-bot retries with exponential backoff can exceed 5 minutes.
2. **Vercel can't run Playwright.** No persistent binary, no headless Chrome, no filesystem for browser cache. It simply doesn't work.
3. **Scraping is I/O bound and bursty.** Multiple designers may paste URLs simultaneously. The scraper needs its own resource pool, not Vercel's function concurrency.

**Solution:** Long-running Node.js container on Fly.io, triggered asynchronously via Inngest.

---

## Components

### 1. Scrape cache (`scrape_cache` table)

First thing checked before enqueuing a job. Two designers pasting the same Delta Faucet URL should trigger one scrape.

```ts
// Server Action — check cache before enqueuing
const hash = sha256(normaliseUrl(url))

const [cached] = await db
  .select()
  .from(scrapeCache)
  .where(eq(scrapeCache.urlHash, hash))
  .limit(1)

if (cached?.status === 'success' && !isExpired(cached.expiresAt)) {
  return { source: 'cache', data: cached.extractedData }
}
```

URL normalisation strips tracking params (`?utm_source=...`), trailing slashes, and fragments so `delta.com/product/T14?ref=ad` and `delta.com/product/T14` hit the same cache entry.

---

### 2. Job queue — Inngest

Inngest sits between Next.js and the scraper. It manages retries, step isolation, and delivery guarantees.

```ts
// Next.js Server Action — enqueue the job
import { inngest } from '@/lib/inngest'

await inngest.send({
  name: 'scrape/url.requested',
  data: { url, urlHash: hash, userId, itemId },
})
```

```ts
// Scraper service — Inngest function
export const scrapeUrl = inngest.createFunction(
  {
    id: 'scrape-url',
    retries: 3,
    concurrency: { limit: 5 },  // max 5 simultaneous Playwright sessions
  },
  { event: 'scrape/url.requested' },
  async ({ event, step }) => {
    const { url, urlHash, userId, itemId } = event.data

    // Step 1: Playwright scrape (retried independently)
    const { html, screenshotBase64 } = await step.run('playwright-scrape', async () => {
      return await runPlaywright(url)
    })

    // Step 2: Claude extraction (retried independently — Playwright doesn't re-run)
    const extracted = await step.run('claude-extract', async () => {
      return await extractWithClaude(html, screenshotBase64)
    })

    // Step 3: Re-host image
    const imageUrl = await step.run('rehost-image', async () => {
      return await rehostImage(extracted.imageUrl, userId, itemId)
    })

    // Step 4: Persist
    await step.run('persist', async () => {
      await db.update(scrapeCache).set({
        status: 'success',
        extractedData: { ...extracted, imageUrl },
        scrapeDurationMs: Date.now() - event.ts,
      }).where(eq(scrapeCache.urlHash, urlHash))
    })

    return { success: true, itemId }
  }
)
```

Step isolation means if Claude extraction fails, Playwright doesn't re-run — only the extraction step is retried. This is important because Playwright sessions are expensive and risk triggering anti-bot systems on repeated hits.

---

### 3. Playwright (stealth)

```ts
import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

chromium.use(StealthPlugin())

export async function runPlaywright(url: string) {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  })

  const page = await context.newPage()

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
    await page.waitForTimeout(2000)  // allow lazy content to render

    const html = await page.content()
    const screenshot = await page.screenshot({ type: 'webp', fullPage: false })

    return { html, screenshotBase64: screenshot.toString('base64') }
  } finally {
    await browser.close()
  }
}
```

**Stealth plugin** patches:
- `navigator.webdriver` flag (primary detection vector)
- Chrome runtime properties
- Canvas fingerprint
- WebGL fingerprint
- Plugin enumeration

**Anti-bot escalation strategy:**

| Attempt | Strategy |
|---|---|
| 1 | Standard Playwright + stealth |
| 2 (retry) | Random delay 3–8s before request |
| 3 (retry) | Residential proxy rotation (future — add when blocked domains accumulate) |
| Give up | Return `status: 'failed'`, fallback to manual entry |

---

### 4. Claude extraction

After Playwright returns HTML, Claude extracts structured product fields.

```ts
export async function extractWithClaude(
  html: string,
  screenshotBase64: string
): Promise<ExtractedProduct> {
  const truncatedHtml = truncateHtml(html, 15_000)  // trim to ~15k chars of meaningful content

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are extracting product data from an interior design product page.

Return a JSON object matching this schema exactly:
{
  "product_name": string | null,
  "brand": string | null,
  "collection": string | null,
  "finishes": string[] | null,   // e.g. ["Stainless", "Matte Black"]
  "sku": string | null,
  "dimensions": object | null,   // e.g. { "rough_in": "1/2 inch IPS" }
  "image_url": string | null     // absolute URL of the main product image
}

Rules:
- Return null for any field you cannot find with confidence.
- Do not invent or guess data. Accuracy matters more than completeness.
- For finishes, return all available finish/colour options you can find.
- For SKU, prefer the model number, not a UPC.

Page HTML:
${truncatedHtml}`,
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/webp',
              data: screenshotBase64,
            },
          },
        ],
      },
    ],
  })

  return JSON.parse(response.content[0].text)
}
```

**Why include the screenshot:** Some product pages render finish swatches as images with no text labels. Claude can read swatches visually and extract finish names the HTML doesn't contain.

**HTML truncation strategy:** Strip `<script>`, `<style>`, `<svg>` tags and hidden elements before passing to Claude. Prioritise the main content area (`main`, `[data-product]`, `.product-details`). 15k characters captures most product pages without hitting context limits.

---

### 5. Fallback states

Three outcomes, each with a defined UX. No outcome crashes the flow.

| Outcome | Condition | What's saved | UX |
|---|---|---|---|
| **Full success** | All key fields extracted | `scrape_cache.status = 'success'`, full `extracted_data` | Form prefilled, designer reviews and corrects |
| **Partial success** | Some fields found | `status = 'success'`, partial `extracted_data` | Form partially filled, missing fields shown as TBD |
| **Full failure** | Timeout, anti-bot block, invalid URL | `status = 'failed'`, `error_message` set | Blank form with URL pre-saved, "Couldn't fetch — fill in manually" message |

The URL is **always saved** to the item record. Even on full failure, the designer has a clickable link to the original page.

---

### 6. Global inventory governance hook

After a successful scrape of a whitelisted domain (delta.com, kohler.com, brizo.com, etc.), the scraper runs the promotion check:

```ts
async function checkGlobalPromotion(extracted: ExtractedProduct, url: string) {
  const domain = new URL(url).hostname.replace('www.', '')

  if (!WHITELISTED_DOMAINS.includes(domain)) return

  // Check for duplicate in global_products
  const [existing] = await db
    .select()
    .from(globalProducts)
    .where(and(
      eq(globalProducts.brand, extracted.brand ?? ''),
      eq(globalProducts.sku, extracted.sku ?? ''),
    ))
    .limit(1)

  if (existing) return  // already in global library

  // Insert into promotion queue for internal review
  await db.insert(promotionQueue).values({
    scrapeUrl: url,
    extractedData: extracted,
    status: 'pending_review',
  })
}
```

Internal review → approve → insert into `global_products`. This is the mechanism that grows the global library without manual data entry at scale.

---

## Scraper service on Fly.io

```dockerfile
# Dockerfile (scraper service)
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Playwright browsers installed by base image
CMD ["node", "dist/server.js"]
```

```toml
# fly.toml
app = "speclyy-scraper"
primary_region = "iad"  # same region as Supabase (us-east-1)

[build]

[http_service]
  internal_port = 3001
  auto_stop_machines = false  # keep warm — cold start adds 2-3s
  min_machines_running = 1

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512  # Playwright needs ~400MB per session
```

One always-on instance handles up to 5 concurrent scrape jobs (Inngest concurrency limit). Scale horizontally with `fly scale count 2` if queue backs up.

---

---

## Bulk crawl mode

Admin-triggered pipeline for building the global product library by scraping entire brand catalogs. See [ADR-0013](adr/0013-bulk-crawl.md) for the full design rationale.

### Overview

```mermaid
flowchart TB
  subgraph Admin["Admin trigger"]
    API["POST /api/admin/crawl\n{ brand, domain, durationDays }"]
  end

  subgraph Inngest
    DISC[crawl/discover\nURL discovery fan-out]
    CRON[cron 6am daily\npick next N URLs]
    PROC[crawl/url.process\nper-URL — throttled 1/8s per domain]
  end

  subgraph DB
    CJ[crawl_jobs\nprogress + status]
    CU[crawl_urls\none row per product URL]
  end

  subgraph Scraper["Scraper (Fly.io)"]
    SITE[sitemap.xml parser\n+ category crawler]
    EXTRACT[Playwright + Claude\nsame as on-demand]
  end

  subgraph Axiom
    LOGS[structured logs\nsuccess rate, completeness, cost]
  end

  API -->|emit crawl/discover| DISC
  DISC --> SITE
  SITE -->|discovered URLs| CU
  DISC --> CJ
  CRON -->|batch_size = total / days| PROC
  PROC -->|throttled| EXTRACT
  EXTRACT --> CU
  EXTRACT --> CJ
  EXTRACT --> LOGS
```

### URL discovery

Two strategies run in sequence:

1. **Sitemap parsing (primary)** — `GET https://{domain}/sitemap.xml`, filter URLs matching product path patterns (`/product/`, `/bathroom/`, etc.). Covers 80–90% of catalog.
2. **Category page crawl (gap fill)** — Playwright renders collection/category pages, extracts product links. Catches products missing from sitemaps.

All discovered URLs inserted into `crawl_urls` with `status: pending`. Duplicates against existing `scrape_cache` entries are marked `skipped`.

### Daily batch processing

```ts
// Inngest cron — fires daily at 6am
{ cron: '0 6 * * *' }

// batch_size = Math.ceil(crawl.totalUrls / crawl.durationDays)
// Fans out crawl/url.process events for the next N pending URLs
```

Delta at 1,200 URLs / 10 days = 120 URLs/day = ~16 minutes of actual scraping at 8s rate limit.

### Rate limiting

Inngest domain throttle — max 1 request per domain per 8 seconds:

```ts
throttle: {
  key: 'event.data.domain',
  count: 1,
  period: '8s',
}
```

Enforced across all concurrent workers automatically. Equivalent to a single person browsing casually — no meaningful load on vendor servers.

### Admin API (MVP — no UI required)

```bash
# Start a crawl
curl -X POST https://app.speclyy.com/api/admin/crawl \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "brand": "Delta", "domain": "deltafaucet.com", "durationDays": 10 }'

# Check progress
curl https://app.speclyy.com/api/admin/crawl/status \
  -H "Authorization: Bearer $ADMIN_API_KEY"
# → { activeCrawls: [{ brand, status, progress: "342/1204", successRate: "94.7%", eta: "2026-04-28" }] }

# Pause / resume
curl -X POST https://app.speclyy.com/api/admin/crawl/{id}/pause \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

`ADMIN_API_KEY` is a long random string in environment variables. No auth UI needed for a 1–2 person team.

### Observability — Axiom

Every URL processed emits a structured log event to Axiom. The Axiom dashboard is the admin screen at MVP.

```kusto
// Success rate by domain — this week
['speclyy-scraper']
| where _time > ago(7d) and mode == "bulk_crawl"
| summarize
    total     = count(),
    succeeded = countif(status == "success"),
    rate      = round(100.0 * countif(status == "success") / count(), 1)
  by domain

// Field completeness trend — Delta crawl
['speclyy-scraper']
| where brand == "Delta" and mode == "bulk_crawl"
| summarize avg_completeness = avg(completeness_pct) by bin(_time, 1d)

// Claude cost tracker
['speclyy-scraper']
| summarize
    est_cost = sum(claude_input_tokens) * 0.000015
             + sum(claude_output_tokens) * 0.000075
  by bin(_time, 1d)
```

Note: APL syntax is near-identical to Azure Monitor KQL (`_time` instead of `timestamp`, same pipeline operators).

---

## Locked decisions

| Decision | Choice | ADR |
|---|---|---|
| Scraper host | Fly.io | [ADR-0010](adr/0010-scraper-host.md) |
| Job queue | Inngest | [ADR-0011](adr/0011-job-queue.md) |
| Extraction model | Claude Opus (`claude-opus-4-5`) | [ADR-0012](adr/0012-extraction-strategy.md) |
| HTML truncation | DOM-pruned ~15k chars + screenshot | [ADR-0012](adr/0012-extraction-strategy.md) |
| Scrape cache TTL | Never expire for product pages | [ADR-0012](adr/0012-extraction-strategy.md) |
| Image re-hosting | Always re-host to Supabase Storage | [ADR-0009](adr/0009-storage.md) |
| Bulk crawl design | Inngest cron + fan-out + domain throttle | [ADR-0013](adr/0013-bulk-crawl.md) |
| Log store | Axiom | [ADR-0014](adr/0014-log-store.md) |

---

## References

- [ADR-0010 — Scraper host: Fly.io](adr/0010-scraper-host.md)
- [ADR-0011 — Job queue: Inngest](adr/0011-job-queue.md)
- [ADR-0012 — Extraction strategy: Claude API](adr/0012-extraction-strategy.md)
- [ADR-0013 — Bulk crawl design](adr/0013-bulk-crawl.md)
- [ADR-0014 — Log store: Axiom](adr/0014-log-store.md)
- [database.md](database.md) — `scrape_cache`, `crawl_jobs`, `crawl_urls` tables
- [storage.md](storage.md) — image re-hosting to Supabase Storage
- [MVP decisions](../mvp-decisions.md) — URL paste behaviour decision
