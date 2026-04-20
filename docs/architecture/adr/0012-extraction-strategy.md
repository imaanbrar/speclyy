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

- **Model:** `claude-opus-4-5` as default. A/B test `claude-sonnet-4-5` after first 500 scrapes if cost becomes material.
- **Input:** DOM-pruned HTML (~15,000 chars) + WebP screenshot as base64
- **Output:** Strict JSON schema, `null` for unfound fields

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

| | Opus (`claude-opus-4-5`) | Sonnet (`claude-sonnet-4-5`) |
|---|---|---|
| Extraction quality | Highest | Good, occasional misses on complex pages |
| Cost per scrape | ~$0.06 | ~$0.02 |
| Latency | ~3s | ~1s |
| Monthly cost at 500/mo | ~$30 | ~$10 |
| Monthly cost per bulk crawl (1,200 URLs) | ~$72 | ~$24 |

At MVP scale, $30/month for on-demand scraping is acceptable. Quality matters more than cost when every scrape result is a designer's product data — wrong finishes or missing SKUs directly erode product trust.

**Decision:** Start with Opus. After 500 scrapes, compare completeness scores between Opus and Sonnet on the same URLs. Downgrade to Sonnet if quality delta is <5% on completeness.

### HTML truncation — DOM-pruned

Three options evaluated:
- **Full HTML** — too large (50–500KB), context limit issues, noise
- **Visible text only** — loses structural context (swatch grids, option values)
- **DOM-pruned** (chosen) — strip `<script>`, `<style>`, `<svg>`, hidden elements; keep content nodes

DOM-pruned HTML keeps structural cues (dropdown option values, data attributes, ARIA labels) while eliminating noise. Target: ~15,000 characters after pruning, covers 95%+ of product pages.

## Cost model

```
Opus pricing: $15 / 1M input tokens, $75 / 1M output tokens
Per scrape:   ~3,200 input tokens + ~180 output tokens
Cost:         (3200 × $0.000015) + (180 × $0.000075) = $0.048 + $0.013 = ~$0.06

Monthly on-demand (500 scrapes):   ~$30
Per bulk crawl (1,200 URLs):       ~$72
Annual estimate (6 crawls + daily on-demand): ~$500
```

Acceptable at MVP. Monitored via `claude_input_tokens` and `claude_output_tokens` fields in Axiom logs.

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

Return a JSON object matching this exact schema:
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

## Alternatives considered

- **CSS/DOM selectors per brand** — Rejected. Requires a selector library per brand, breaks on redesign, ongoing maintenance cost exceeds Claude API spend.
- **GPT-4o (OpenAI)** — Comparable quality. Rejected because: no relationship with the Anthropic API we'd have anyway (Claude is Speclyy's AI partner for the scraper and future features), and GPT-4o pricing is similar without a differentiation reason.
- **Gemini 1.5 Pro** — Very large context window (1M tokens). Rejected because: we don't need >15K tokens of HTML; quality on structured extraction tasks is comparable to Sonnet, not Opus; mixing AI vendors adds complexity.
- **Fine-tuned smaller model** — Could reduce cost significantly. Rejected because: requires training data we don't have yet; ongoing fine-tuning as vendor pages change; complexity not justified at MVP.
