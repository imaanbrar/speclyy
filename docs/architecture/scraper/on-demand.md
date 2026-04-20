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
  ))
  .limit(1)

if (cached && !isExpired(cached.expiresAt)) {
  return { source: 'cache', data: cached.extractedData }
}
// → instant, ~100ms, no Playwright, no Claude cost
```

**URL normalisation** strips tracking parameters (`?utm_source=...`, `?ref=...`), trailing slashes, and URL fragments. `delta.com/product/T14?ref=ad` and `delta.com/product/T14` hash identically.

Two designers pasting the same Delta faucet URL trigger one scrape and both get the cached result.

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

### Realtime update hook

```ts
// Client component — product item row
useEffect(() => {
  const channel = supabase
    .channel(`item:${itemId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'project_items',
      filter: `id=eq.${itemId}`,
    }, (payload) => {
      setItem(payload.new)
    })
    .subscribe()

  return () => supabase.removeChannel(channel)
}, [itemId])
```

---

## Inngest job — step isolation

Each stage is an independent Inngest step. If Claude fails, Playwright doesn't re-run. If image upload fails, extraction doesn't re-run. Expensive operations are retried only if they fail.

```ts
// scraper/functions/scrape-url.ts
export const scrapeUrl = inngest.createFunction(
  {
    id: 'scrape-url',
    retries: 3,
    concurrency: { limit: 5 },  // max 5 simultaneous Playwright sessions
  },
  { event: 'scrape/url.requested' },
  async ({ event, step }) => {
    const { url, urlHash, userId, itemId } = event.data

    // Step 1 — Playwright (expensive, retried independently)
    const { html, screenshotBase64 } = await step.run('playwright-scrape', async () => {
      return await playwrightPool.runScrape(url)
    })

    // Step 2 — Claude (Playwright doesn't re-run if this fails)
    const extracted = await step.run('claude-extract', async () => {
      return await extractWithClaude(html, screenshotBase64)
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

    return { success: true }
  }
)
```

---

## Playwright — stealth config

```ts
// scraper/lib/playwright-pool.ts
import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

chromium.use(StealthPlugin())

export async function runScrape(url: string) {
  const page = await playwrightPool.acquire()  // warm page from pool

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
    await page.waitForTimeout(1500)  // allow lazy content / JS rendering

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

**Anti-bot escalation per URL:**

| Attempt | Strategy |
|---|---|
| 1 | Standard Playwright + stealth |
| 2 (auto-retry) | Random delay 3–8s before navigation |
| 3 (auto-retry) | Residential proxy rotation (added when blocked-domain list accumulates) |
| Give up | `status = 'failed'`, `error_type = 'anti_bot'` — designer gets inline edit fallback |

---

## Claude extraction

```ts
// scraper/lib/claude.ts
export async function extractWithClaude(
  html: string,
  screenshotBase64: string
): Promise<ExtractedProduct> {
  const cleanHtml = pruneHtml(html, 15_000)  // strip scripts/styles, trim to 15k chars

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: `You are extracting product data from an interior design product page.

Return a JSON object with this schema exactly:
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

  return JSON.parse(response.content[0].text)
}
```

**Why the screenshot matters:** Finish swatches are often images with no text labels. Claude reads them visually and names the finishes (Matte Black, Champagne Bronze) even when the HTML only contains `<img src="swatch-cb.png">`.

---

## Fallback states

Every outcome has a defined path. Nothing crashes or blocks.

| Outcome | Condition | Saved state | Designer UX |
|---|---|---|---|
| **Full success** | All key fields extracted | `status = 'success'`, full `extracted_data` | Form prefilled, review and correct |
| **Partial success** | Some fields found (≥1) | `status = 'success'`, partial `extracted_data` | Filled fields shown, missing ones are TBD |
| **Failure** | Timeout / anti-bot / Claude error | `status = 'failed'`, `error_type` set | Inline edit shown with whatever was found |

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
