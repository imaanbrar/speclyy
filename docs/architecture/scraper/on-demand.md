# On-Demand Scraping

A designer pastes a single product URL. Speclyy returns prefilled specification fields as fast as possible, with graceful fallback if anything fails.

---

## Cache check (deduplication)

Before enqueuing any job, check whether we've already scraped this URL.

```ts
// Next.js Server Action — lib/actions/scrape.ts
const hash = sha256(normaliseUrl(url))

const [cached] = await db
  .select()
  .from(scrapeCache)
  .where(and(
    eq(scrapeCache.urlHash, hash),
    eq(scrapeCache.status, 'success'),
    gt(scrapeCache.expiresAt, new Date()),   // TTL gate — default 90 days
  ))
  .limit(1)

if (cached) {
  return { source: 'cache', data: cached.extractedData }
}
// → instant, ~100ms, no Playwright, no Claude cost
```

**URL normalisation** strips tracking parameters (`?utm_source=...`, `?ref=...`), trailing slashes, and URL fragments. `delta.com/product/T14?ref=ad` and `delta.com/product/T14` hash identically.

Two designers pasting the same Delta faucet URL trigger one scrape and both get the cached result.

**Cache TTL.** `expires_at` defaults to `now() + interval '90 days'` — long enough to benefit from the flywheel, short enough that renamed SKUs and discontinued products don't silently poison the library. Known-stable domains (Delta, Kohler core lines) override to 1 year in `domains.ts`. Volatile domains (retailers with rotating availability) override to 14 days. Re-scraping an expired entry is an automatic background job; see [performance.md — popular URL refresh](performance.md).

---

## Async UX — save first, scrape in background

The scraper takes 8–35s. Users tolerate ~10s of waiting for a *visible action*. The solution: detach scraping completely from the save action.

```
T+0ms    Designer pastes URL, clicks Fetch
T+50ms   Item row appears in group immediately
           product_name = URL hostname (e.g. "deltafaucet.com")
           status = 'tbd', all fields = null, scrape_status = 'loading'
T+50ms   Inngest job enqueued in background (fire-and-forget)
T+?      Supabase Realtime pushes update when scrape completes
T+?      Fields populate in-place, no page reload
```

The item is **always saved** immediately. The designer can add notes, move on, come back. The scrape result arrives when it's ready.

### Realtime update hook — one channel per project

Subscribe **once per open project**, not once per item. A designer with 50 loading items would otherwise open 50 channels, and Supabase Pro caps at 500 concurrent channels across all users.

```ts
// Client component — project page (subscribes once for ALL items in the project)
useEffect(() => {
  const channel = supabase
    .channel(`project:${projectId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'project_items',
      filter: `project_id=eq.${projectId}`,
    }, (payload) => {
      dispatchItemUpdate(payload.new)   // reducer updates the matching row in store
    })
    .subscribe()

  return () => supabase.removeChannel(channel)
}, [projectId])
```

At 300 concurrent designers × ~1 open project each ≈ 300 channels — well inside the 500 ceiling. Individual item components read from the store, not from Realtime directly.

---

## Inngest job — step isolation

Each stage is an independent Inngest step. If Claude fails, Playwright doesn't re-run. If image upload fails, extraction doesn't re-run. Expensive operations are retried only if they fail.

**Payload size:** Inngest caps step payloads at **512KB** and a base64 WebP screenshot alone can be 300–800KB. HTML + screenshot are therefore written to Supabase Storage in step 1; subsequent steps receive only the `scrapeAssetKey` and re-fetch what they need. See [ADR-0011](../adr/0011-job-queue.md) "Event payload size limit" for the full rationale.

**Concurrency scope:** Inngest's `concurrency.limit` is enforced **per Inngest function across the whole app**, not per Fly.io machine. With 1 machine + `limit: 5` the browser pool (size 4–6) is the binding constraint. When you scale to 2 machines via `fly scale count 2`, bump `limit` to `10` so each machine can keep its pool busy.

```ts
// scraper/functions/scrape-url.ts
export const scrapeUrl = inngest.createFunction(
  {
    id: 'scrape-url',
    retries: 3,
    concurrency: { limit: 5 },  // per Inngest app (across all Fly machines) — bump when scaling out
  },
  { event: 'scrape/url.requested' },
  async ({ event, step }) => {
    const { url, urlHash, userId, itemId } = event.data

    // Step 0 — Compliance pre-flight. Fails fast on ToS-blocked domains (no cost, no network).
    // See compliance.md for the policy and the BLOCKED_DOMAINS list.
    const block = await step.run('compliance-check', async () => {
      return isBlocked(new URL(url).hostname)
    })
    if (block) {
      await step.run('record-blocked', async () => {
        await recordFailure(urlHash, 'tos_blocked', block.reason)
        await db.update(projectItems).set({
          scrapeStatus: 'failed',
          // item stays in place with the original URL preserved
        }).where(eq(projectItems.id, itemId))
      })
      return { blocked: true, reason: block.reason }
    }

    // Step 1 — Playwright + stash raw assets in Storage (keeps subsequent step payloads small)
    const scrapeAssetKey = await step.run('playwright-scrape', async () => {
      const { html, screenshotBase64 } = await playwrightPool.runScrape(url)
      await storage.uploadScrapeAssets(urlHash, { html, screenshotBase64 })
      return urlHash   // ~64 bytes in the step payload, well under 512KB
    })

    // Step 2 — Claude (re-reads assets from Storage; Playwright doesn't re-run on retry)
    const extracted = await step.run('claude-extract', async () => {
      const { html, screenshotBase64 } = await storage.loadScrapeAssets(scrapeAssetKey)
      return await extractWithClaude(html, screenshotBase64)   // Zod-validated internally
    })

    // Step 3 — Image re-hosting (Claude doesn't re-run if this fails)
    const imageUrl = await step.run('rehost-image', async () => {
      if (!extracted.image_url) return null
      return await rehostImage(extracted.image_url, userId, itemId)
    })

    // Step 4 — Persist result + notify
    await step.run('persist', async () => {
      await db.update(scrapeCache).set({
        status: 'success',
        extractedData: { ...extracted, image_url: imageUrl },
        scrapeDurationMs: Date.now() - event.ts,
        attempts: sql`${scrapeCache.attempts} + 1`,
        lastAttemptedAt: new Date(),
        expiresAt: sql`now() + interval '90 days'`,   // default TTL, overridable per domain
      }).where(eq(scrapeCache.urlHash, urlHash))

      // Propagate to project_item so Realtime fires
      await db.update(projectItems).set({
        productName: extracted.product_name ?? 'Unknown product',
        brand: extracted.brand,
        collection: extracted.collection,
        finish: extracted.finishes?.[0],
        sku: extracted.sku,
        dimensions: extracted.dimensions,
        imageUrl,
        scrapeStatus: 'success',
      }).where(eq(projectItems.id, itemId))
    })

    // Step 5 — Governance check (promote to global library)
    await step.run('governance-check', async () => {
      await checkGlobalPromotion(extracted, url)
    })

    // Step 6 — Clean up stashed assets (HTML + screenshot no longer needed)
    await step.run('cleanup-assets', async () => {
      await storage.deleteScrapeAssets(scrapeAssetKey)
    })

    return { success: true }
  }
)
```

### Asset storage helper

```ts
// scraper/lib/storage.ts — stashes raw HTML + screenshot between Inngest steps
const BUCKET = 'scrape-assets'   // Supabase Storage bucket, private, 24h lifecycle rule

export const storage = {
  uploadScrapeAssets: async (key: string, payload: { html: string; screenshotBase64: string }) => {
    await supabase.storage.from(BUCKET).upload(
      `${key}.json`,
      JSON.stringify(payload),
      { contentType: 'application/json', upsert: true },
    )
  },
  loadScrapeAssets: async (key: string) => {
    const { data } = await supabase.storage.from(BUCKET).download(`${key}.json`)
    return JSON.parse(await data!.text()) as { html: string; screenshotBase64: string }
  },
  deleteScrapeAssets: async (key: string) => {
    await supabase.storage.from(BUCKET).remove([`${key}.json`])
  },
}
```

The `scrape-assets` bucket has a 24-hour lifecycle rule — abandoned assets (e.g. from a failed final cleanup step) are removed automatically. Stored assets are transient debug material, not part of the product data surface.

---

## Playwright — stealth config

```ts
// scraper/lib/playwright-pool.ts
import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { getConfig } from '../config/domains'

chromium.use(StealthPlugin())

export async function runScrape(url: string) {
  const page = await playwrightPool.acquire()  // warm page from pool
  const cfg = getConfig(new URL(url).hostname.replace(/^www\./, ''))

  try {
    await page.goto(url, { waitUntil: cfg.waitUntil, timeout: cfg.timeout })

    // Wait for a concrete data signal instead of a fixed sleep.
    // Default selectors match most product pages; per-domain overrides live in domains.ts.
    await page.waitForSelector(cfg.waitSelector, { timeout: 5_000 }).catch(() => {
      // Selector never appeared — still try to extract from whatever rendered.
    })

    const html = await page.content()
    const screenshot = await page.screenshot({ type: 'webp', fullPage: false })

    return { html, screenshotBase64: screenshot.toString('base64') }
  } finally {
    await playwrightPool.release(page)  // return to pool, don't close
  }
}
```

**Stealth plugin patches:**
- `navigator.webdriver` flag (primary detection vector)
- Chrome runtime properties
- Canvas + WebGL fingerprint
- Plugin enumeration

### Robots.txt policy

Scrape only URLs a designer explicitly pasted, or URLs linked from a vendor's own sitemap/category pages. The scraper identifies itself with a `User-Agent: Speclyy/1.0 (+https://speclyy.com/scraper)` on every request so vendors can contact us.

Per-domain robots.txt is honoured in `domains.ts`: `respectRobots: true` is the default, which causes the scraper to short-circuit with `error_type = 'invalid_url'` if the path is disallowed. Set `false` only for domains where we have explicit written permission from the vendor.

### Anti-bot escalation per URL

| Attempt | Strategy | Added cost |
|---|---|---|
| 1 | Standard Playwright + stealth | Baseline |
| 2 (auto-retry) | Random delay 3–8s before navigation | — |
| 3 (auto-retry) | Residential proxy rotation via **Bright Data** (pay-as-you-go tier, ~$8/GB) — enabled per domain in `domains.ts` once `anti_bot` failure rate exceeds 20% over a 7-day window | ~$0.02–0.05/scrape for sites that need it (typical product page ≈ 3–6 MB through the proxy) |
| Give up | `status = 'failed'`, `error_type = 'anti_bot'` — designer gets inline edit fallback | — |

Proxy credentials live in Fly secrets (`PROXY_URL`, `PROXY_USERNAME`, `PROXY_PASSWORD`). Budget alert fires in Axiom when monthly proxy spend crosses $50 so we catch runaway cost early.

---

## Claude extraction

```ts
// scraper/lib/claude.ts
import { ExtractedProductSchema, type ExtractedProduct } from './extracted-product'
import { ScrapeError } from './errors'

export async function extractWithClaude(
  html: string,
  screenshotBase64: string,
): Promise<ExtractedProduct> {
  const cleanHtml = pruneHtml(html, 15_000)  // strip scripts/styles, trim to 15k chars

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: `You are extracting product data from an interior design product page.

Respond with JSON only — no markdown fences, no preamble, no trailing prose.

Schema:
{
  "product_name": string | null,
  "brand":        string | null,
  "collection":   string | null,
  "finishes":     string[] | null,   // e.g. ["Stainless", "Matte Black"]
  "sku":          string | null,
  "dimensions":   object | null,     // e.g. { "rough_in": "1/2 inch IPS" }
  "image_url":    string | null      // absolute URL of the main product image
}

Rules:
- Return null for any field you cannot find with confidence.
- Do not invent or guess. Accuracy matters more than completeness.
- For finishes, return all available options you can find on the page.
- For SKU, prefer the model number — not a UPC or internal ID.

Page HTML:
${cleanHtml}`,
        },
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/webp', data: screenshotBase64 },
        },
      ],
    }],
  })

  // Strip markdown fences Claude occasionally wraps JSON in, despite the instruction.
  const raw = (response.content[0] as { type: 'text'; text: string }).text.trim()
  const jsonText = raw.replace(/^```(?:json)?\s*|\s*```$/g, '')

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch (err) {
    throw new ScrapeError('claude_error', `Invalid JSON from Claude: ${(err as Error).message}`)
  }

  const result = ExtractedProductSchema.safeParse(parsed)
  if (!result.success) {
    throw new ScrapeError('parse_error', `Schema mismatch: ${result.error.message}`)
  }
  return result.data
}
```

Validation is **mandatory** — Claude occasionally hallucinates an extra field, wraps output in prose, or emits an invalid URL in `image_url`. The Zod schema (defined in [ADR-0012](../adr/0012-extraction-strategy.md)) catches all three. Parse failures are classified in [failure-tracking.md](failure-tracking.md) as `claude_error` (invalid JSON) or `parse_error` (JSON valid, schema wrong) so they show up in the right Axiom query bucket.

**Why the screenshot matters:** Finish swatches are often images with no text labels. Claude reads them visually and names the finishes (Matte Black, Champagne Bronze) even when the HTML only contains `<img src="swatch-cb.png">`.

---

## Fallback states

Every outcome has a defined path. Nothing crashes or blocks.

| Outcome | Condition | Saved state | Designer UX |
|---|---|---|---|
| **Full success** | All key fields extracted | `status = 'success'`, full `extracted_data` | Form prefilled, review and correct |
| **Partial success** | Some fields found (≥1) | `status = 'success'`, partial `extracted_data` | Filled fields shown, missing ones are TBD |
| **Failure** | Timeout / anti-bot / Claude error | `status = 'failed'`, `error_type` set | Inline edit shown with whatever was found |
| **Policy-blocked** | Domain on `BLOCKED_DOMAINS` list | `status = 'failed'`, `error_type = 'tos_blocked'` | Blame-neutral "vendor doesn't permit automated capture" message, manual-entry only (no retry). See [compliance.md](compliance.md). |

---

## Failure UX — inline editor

On failure, the item **stays in place** in the group. The designer never loses context (position, notes already added, the original URL).

```
┌──────────────────────────────────────────────────────────────┐
│  ⚠  Couldn't load this product automatically                 │
│     deltafaucet.com/products/faucet-t14094-i                 │
│                                                              │
│  Product name  [                                       ]     │
│  Brand         [ Delta                                 ]  ← partial data shown
│  SKU           [                                       ]     │
│  Finish        [                                       ]     │
│                                                              │
│  [ ↻ Try again ]   [ ✎ Fill in manually ]                   │
└──────────────────────────────────────────────────────────────┘
```

**Behaviour:**
- Show whatever fields Claude extracted (brand, product name) — even partial data is useful
- "Try again" re-enqueues the scrape job (one tap, no re-paste)
- "Fill in manually" opens the standard edit sheet with URL pre-populated
- Original URL always saved and clickable — designer can open the source page themselves
- Item `status` stays `tbd` — it shows up in the "needs attention" count

---

## Global inventory governance hook

After a successful scrape of a whitelisted domain, check whether to promote the product to the global library.

```ts
const WHITELISTED_DOMAINS = [
  'deltafaucet.com', 'us.kohler.com', 'brizo.com',
  'moen.com', 'hansgrohe-usa.com', 'duravit.com',
  // expand as brand coverage grows
]

async function checkGlobalPromotion(extracted: ExtractedProduct, url: string) {
  const domain = new URL(url).hostname.replace('www.', '')
  if (!WHITELISTED_DOMAINS.includes(domain)) return

  const [existing] = await db
    .select({ id: globalProducts.id })
    .from(globalProducts)
    .where(and(
      eq(globalProducts.brand, extracted.brand ?? ''),
      eq(globalProducts.sku, extracted.sku ?? ''),
    ))
    .limit(1)

  if (existing) return  // already in library

  await db.insert(promotionQueue).values({
    scrapeUrl: url,
    extractedData: extracted,
    status: 'pending_review',
  })
}
```

Internal review → approve → inserted into `global_products`. This grows the trusted library passively as designers use the URL feature.
