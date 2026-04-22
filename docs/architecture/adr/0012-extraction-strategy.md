# ADR-0012: Extraction strategy — Claude API

- **Status:** Accepted
- **Date:** 2026-04-20

## Context

After Playwright captures a product page's HTML and a screenshot, we need to extract structured fields:

```
product_name, brand, collection, finishes[], sku,
dimensions{}, image_url
```

Two fundamentally different approaches: **CSS/DOM selectors** or **LLM extraction**.

We also need to pick a model if we go the LLM route.

## Decision

Use **Claude API** for extraction, passing truncated HTML + a screenshot.

- **Model:** `claude-opus-4-7` as default. A/B test `claude-sonnet-4-6` after first 500 scrapes if cost becomes material.
- **Input:** DOM-pruned HTML (~15,000 chars) + WebP screenshot as base64
- **Output:** Zod-validated JSON schema, `null` for unfound fields

## Rationale

### LLM over CSS selectors

**CSS selectors break when vendors redesign.** Delta, Kohler, and Brizo each redesign product pages 1–2 times per year. Every redesign breaks selector-based scrapers. Maintaining a selector library across 10+ brands is ongoing engineering work — it never stops.

**Layout variance is the core problem.** The same brand uses different HTML structures across product lines:
- Finishes as a dropdown `<select>` on some pages
- Finishes as a swatch grid with `data-color` attributes on others
- Finishes as tab panels loaded via XHR on others

An LLM reads the *meaning* of the page, not its structure. `"find all finish/colour options"` works regardless of which HTML pattern the vendor chose.

**Screenshot captures what HTML misses.** Finish swatches are often images — `<img src="swatch-matte-black.jpg" alt="">` with no text label. The LLM reads the screenshot visually and can identify "Matte Black" from the swatch image when the HTML has no text for it.

### Model choice — Opus over Sonnet for MVP

| | Opus (`claude-opus-4-7`) | Sonnet (`claude-sonnet-4-6`) |
|---|---|---|
| Extraction quality | Highest | Good, occasional misses on complex pages |
| Cost per scrape | ~$0.038 | ~$0.023 |
| Latency | ~3s | ~1s |
| Monthly cost at 2,250/mo | ~$86 | ~$52 |
| Monthly cost per bulk crawl (1,200 URLs) | ~$46 | ~$28 |

At MVP scale, ~$86/month for on-demand scraping is acceptable. Quality matters more than cost when every scrape result is a designer's product data — wrong finishes or missing SKUs directly erode product trust.

**Decision:** Start with Opus. After 500 scrapes, compare completeness scores between Opus and Sonnet on the same URLs. Downgrade to Sonnet if quality delta is <5% on completeness.

### HTML truncation — DOM-pruned

Three options evaluated:
- **Full HTML** — too large (50–500KB), context limit issues, noise
- **Visible text only** — loses structural context (swatch grids, option values)
- **DOM-pruned** (chosen) — strip `<script>`, `<style>`, `<svg>`, hidden elements; keep content nodes

DOM-pruned HTML keeps structural cues (dropdown option values, data attributes, ARIA labels) while eliminating noise. Target: ~15,000 characters after pruning, covers 95%+ of product pages.

## Cost model

```
Opus 4.7 pricing (April 2026): $5 / 1M input tokens, $25 / 1M output tokens

Per scrape input tokens:
  System prompt + instructions:    ~300
  DOM-pruned HTML (~15k chars):  ~5,000   (~3 chars/token for HTML)
  WebP screenshot (1280×800):    ~1,365   (width × height / 750)
  Total input:                   ~6,665
Per scrape output tokens:          ~200   (7 JSON fields)

Cost: (6,665 × $0.000005) + (200 × $0.000025) = $0.033 + $0.005 = ~$0.038

Monthly on-demand (2,250 scrapes, 25% cache hit):   ~$86
Per bulk crawl (1,200 URLs):                        ~$46
Annual estimate (6 crawls + daily on-demand):       ~$1,300
```

The screenshot is billed as image tokens — ~20% of input cost. Don't forget it when projecting spend.

Monitored via `claude_input_tokens`, `claude_output_tokens`, and `claude_image_tokens` fields in Axiom logs. See [estimated-infra-costs.md](../estimated-infra-costs.md) for the full cost walkthrough including Sonnet comparison.

## Consequences

**Positive**
- Zero selector maintenance — no breakage on vendor page redesigns.
- Handles layout variance across brands without per-brand configuration.
- Vision capability extracts finish names from swatch images.
- `null` for unfound fields is explicit — partial results are valid, not errors.

**Negative**
- ~$0.06/scrape ongoing cost. Manageable at MVP, grows with volume.
- Non-deterministic — same page may return slightly different field values on re-scrape. Mitigated by scrape cache (same URL scraped once unless cache expires).
- Extraction prompt must be maintained as new field types emerge (e.g. adding `material` as a field requires prompt update).

## Extraction prompt design

```ts
const EXTRACTION_PROMPT = `
You are extracting product data from an interior design product page.

Return a JSON object matching this exact schema. Respond with JSON only — no
markdown fences, no preamble, no trailing prose.

{
  "product_name": string | null,
  "brand": string | null,
  "collection": string | null,
  "finishes": string[] | null,
  "sku": string | null,
  "dimensions": object | null,
  "image_url": string | null
}

Rules:
- Return null for any field you cannot find with high confidence.
- Do NOT invent, guess, or infer data not present on the page.
- For finishes: return ALL available finish/colour options (e.g. ["Stainless", "Matte Black", "Champagne Bronze"]).
- For SKU: prefer the model number over a UPC or internal ID.
- For image_url: return the absolute URL of the main product image.
- Accuracy matters more than completeness.

Page HTML (truncated):
{html}
`
```

### Schema validation (required)

Claude output is validated against a Zod schema before persistence. A parse failure is classified as `error_type = 'claude_error'` ([failure-tracking.md](../scraper/failure-tracking.md)) and the step retries once; markdown-fenced output (` ```json ... ``` `) is stripped before parsing.

```ts
// scraper/lib/extracted-product.ts
import { z } from 'zod'

export const ExtractedProductSchema = z.object({
  product_name: z.string().min(1).nullable(),
  brand:        z.string().min(1).nullable(),
  collection:   z.string().min(1).nullable(),
  finishes:     z.array(z.string().min(1)).nullable(),
  sku:          z.string().min(1).nullable(),
  dimensions:   z.record(z.string(), z.string()).nullable(),
  image_url:    z.string().url().nullable(),
})
export type ExtractedProduct = z.infer<typeof ExtractedProductSchema>
```

## Alternatives considered

- **CSS/DOM selectors per brand** — Rejected. Requires a selector library per brand, breaks on redesign, ongoing maintenance cost exceeds Claude API spend.
- **GPT-4o (OpenAI)** — Comparable quality. Rejected because: no relationship with the Anthropic API we'd have anyway (Claude is Speclyy's AI partner for the scraper and future features), and GPT-4o pricing is similar without a differentiation reason.
- **Gemini 1.5 Pro** — Very large context window (1M tokens). Rejected because: we don't need >15K tokens of HTML; quality on structured extraction tasks is comparable to Sonnet, not Opus; mixing AI vendors adds complexity.
- **Fine-tuned smaller model** — Could reduce cost significantly. Rejected because: requires training data we don't have yet; ongoing fine-tuning as vendor pages change; complexity not justified at MVP.
