// Main scrape pipeline — adapter-first, plain → Zyte-HTTP → Zyte-browser.
//
// Fetch layers run in order; first usable data wins.
//
//   Layer 1a (free, ~200–500ms): plain HTTP fetch with browser headers.
//     → adapter (Shopify/Amazon/…) → JSON-LD block → cheap Claude pass.
//     Cheap Claude accepts iff product_name AND brand AND image_url are
//     all non-null; partial data falls through. 4xx/5xx/timeout also
//     falls through.
//
//   Layer 1b (paid, ~2–5s): Zyte httpResponseBody — proxy rotation
//     without the browser. Fast; clears IP/TLS-fingerprint blocks
//     (Wayfair, Delta, Rejuvenation). Fails on Akamai JS challenges.
//     Up to 3 anti-bot retries.
//
//   Layer 1c (paid, ~10–30s): Zyte browserHtml — real headless Chrome +
//     waitForSelector. Final fallback when Layer 1b produces an all-null
//     extraction. Up to 3 anti-bot retries. If this fails, the whole
//     scrape fails and the error is cached.
//
// Layers 1b/1c only run if ZYTE_API_KEY is set and USE_ZYTE!=0.
//
// Extraction order inside each fetch layer:
//   i.   Adapters in registry order (matches() first hit wins).
//   ii.  JSON-LD Product block → Claude normalisation.
//   iii. Full HTML → Claude extraction.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extract, extractFromJsonLd, type ExtractResult } from './claude.ts';
import { fetchPageViaZyteHttp, fetchPageViaZyteBrowser } from './zyte.ts';
import { fetchHtml, type FetchResult } from './fetch-html.ts';
import {
  readCache,
  writeCache,
  successEntry,
  failureEntry,
  type CacheEntry,
} from './cache.ts';
import { normaliseUrl, urlHash } from './url.ts';
import { pruneHtml } from './prune-html.ts';
import { detectAntiBot } from './anti-bot.ts';
import { findProductInHtml } from './jsonld.ts';
import { normaliseJsonLd } from './jsonld-normalize.ts';
import { resolveBrandOverride } from './brand-override.ts';
import { ADAPTERS } from './adapters/index.ts';
import type { ExtractedProduct } from './schema.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEBUG_DIR = join(HERE, '..', '.cache', 'debug');

export type ScrapePath =
  | `adapter:${string}`
  | 'jsonld'
  | 'plain+claude'
  | 'zyte+claude';

export interface ScrapeResult {
  source: 'cache' | 'scrape';
  entry: CacheEntry;
  metrics?: {
    path: ScrapePath;
    fetchDurationMs: number;
    /** Where the HTML came from. `plain` = bare fetch, `zyte-http` = Zyte
     *  proxy-rotation without browser, `zyte-browser` = full headless. */
    fetchSource: 'plain' | 'zyte-http' | 'zyte-browser';
    claudeDurationMs: number | null;
    inputTokens: number | null;
    outputTokens: number | null;
    model: string | null;
    fallbackUsed: boolean;
    adapterTrace?: Record<string, string>;
  };
}

async function dumpDebug(
  hash: string,
  html: string,
  screenshotBase64: string | null,
) {
  await mkdir(DEBUG_DIR, { recursive: true });
  const writes: Array<Promise<unknown>> = [
    writeFile(join(DEBUG_DIR, `${hash}.raw.html`), html, 'utf-8'),
    writeFile(
      join(DEBUG_DIR, `${hash}.pruned.html`),
      pruneHtml(html, 40_000),
      'utf-8',
    ),
  ];
  if (screenshotBase64) {
    writes.push(
      writeFile(
        join(DEBUG_DIR, `${hash}.jpg`),
        Buffer.from(screenshotBase64, 'base64'),
      ),
    );
  }
  await Promise.all(writes);
  console.error(`[debug] dumped to ${DEBUG_DIR}/${hash}.*`);
}

function isAllNull(data: Record<string, unknown>): boolean {
  return Object.values(data).every(
    (v) => v === null || (Array.isArray(v) && v.length === 0),
  );
}

/**
 * Widen a `Partial<ExtractedProduct>` into the full shape (nulls for missing
 * keys). Current adapters already return all keys, but the type is partial so
 * we stay defensive.
 */
function normaliseAdapterData(d: Partial<ExtractedProduct>): ExtractedProduct {
  return {
    product_name: d.product_name ?? null,
    brand: d.brand ?? null,
    collection: d.collection ?? null,
    finishes: d.finishes ?? null,
    sku: d.sku ?? null,
    dimensions: d.dimensions ?? null,
    image_url: d.image_url ?? null,
  };
}

/**
 * Plain fetch with browser headers. Returns null on network failure, timeout,
 * or non-2xx (sites like rejuvenationhome return a stock 403 HTML error page
 * — we don't want to feed that into adapters/JSON-LD and pretend it worked).
 */
async function safeFetchHtml(url: string): Promise<FetchResult | null> {
  try {
    const r = await fetchHtml(url);
    if (r.status >= 400) {
      console.error(
        `[scrape] plain fetch ${r.status} — will try rendered fetch`,
      );
      return null;
    }
    return r;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[scrape] plain fetch failed: ${msg} — will try rendered fetch`,
    );
    return null;
  }
}

type ExtractHit =
  | {
      kind: 'adapter';
      name: string;
      data: ExtractedProduct;
      trace: Record<string, string>;
    }
  | { kind: 'jsonld'; data: ExtractedProduct; claude: ExtractResult | null }
  | null;

/**
 * Shared layer-2: given HTML (from any source), try adapter → JSON-LD.
 * Returns the first hit with non-all-null data, or null to signal caller
 * should fall through to full-HTML Claude extraction.
 */
async function runAdaptersAndJsonLd(
  url: string,
  html: string,
): Promise<ExtractHit> {
  for (const adapter of ADAPTERS) {
    if (!adapter.matches(url, html)) continue;
    const started = Date.now();
    const r = await adapter.extract(html, url);
    const ms = Date.now() - started;
    const data = normaliseAdapterData(r.data);
    if (isAllNull(data)) {
      console.error(
        `[scrape] adapter:${adapter.name} matched but all-null (${ms}ms) — falling through`,
      );
      continue;
    }
    console.error(`[scrape] adapter:${adapter.name} hit in ${ms}ms`);
    return { kind: 'adapter', name: adapter.name, data, trace: r.trace };
  }

  const jsonLd = findProductInHtml(html);
  if (jsonLd) {
    // Deterministic pass first: handles the Schema.org standard shape
    // variations (brand as string|object, image as string|array|{url},
    // QuantitativeValue dimensions with unit codes) without spending a
    // Claude call. ~0ms, free, predictable.
    const normalised = normaliseJsonLd(jsonLd);
    const hasCritical =
      !!normalised.product_name &&
      !!normalised.brand &&
      !!normalised.image_url;
    const useClaude = process.env.USE_CLAUDE_JSONLD !== '0';

    // Skip Claude when: env disables it, OR the normalizer already has
    // the three critical fields (product_name, brand, image_url). The
    // collection/finishes gaps are tolerated — no standard field for
    // them, and we accept partial data.
    if (!useClaude || hasCritical) {
      if (!isAllNull(normalised)) {
        console.error(
          `[scrape] jsonld normalised${useClaude ? ' (critical fields complete)' : ' (claude disabled)'}`,
        );
        return { kind: 'jsonld', data: normalised, claude: null };
      }
      console.error(
        '[scrape] jsonld found but normaliser all-null — falling through',
      );
    } else {
      const result = await extractFromJsonLd(jsonLd);
      if (!isAllNull(result.data)) {
        console.error(
          `[scrape] jsonld hit — claude=${result.claudeDurationMs}ms model=${result.model}${result.fallbackUsed ? ' (fallback)' : ''}`,
        );
        return { kind: 'jsonld', data: result.data, claude: result };
      }
      console.error('[scrape] jsonld found but all-null — falling through');
    }
  }

  return null;
}

type RenderedFetch = () => Promise<{
  html: string;
  screenshotBase64: string | null;
  fetchDurationMs: number;
}>;

/**
 * Runs a rendered-fetch source (currently only Zyte) end-to-end: fetch →
 * adapter/JSON-LD → full-HTML Claude. Any throw / anti-bot page / all-null
 * Claude result is logged and returns null so the caller can decide how to
 * report the miss. Left generic on path/fetchSource so a future middle tier
 * (e.g. curl-impersonate) can reuse it.
 */
async function tryRenderedSource(
  url: string,
  hash: string,
  started: number,
  fetcher: RenderedFetch,
  path: 'zyte+claude',
  fetchSource: 'zyte-http' | 'zyte-browser',
  maxAntiBotAttempts: number,
): Promise<ScrapeResult | null> {
  // Fetch with anti-bot retry. Some CDNs (Akamai, Cloudflare) throw a
  // transient challenge/interstitial on the first hit but serve the real
  // page on a retry — often because the first response set cookies that
  // the next one carries, or the edge routed us to a different POP.
  // Hard fetch errors (timeout/network/crash) still fail-fast; only the
  // "got HTML but it's an anti-bot page" case retries.
  const MAX_ANTI_BOT_ATTEMPTS = maxAntiBotAttempts;
  let assets: Awaited<ReturnType<RenderedFetch>> | null = null;
  let lastAntiBot: string | null = null;
  for (let attempt = 1; attempt <= MAX_ANTI_BOT_ATTEMPTS; attempt++) {
    let candidate: Awaited<ReturnType<RenderedFetch>>;
    try {
      candidate = await fetcher();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[scrape] ${fetchSource} fetch failed: ${msg}`);
      return null;
    }
    if (process.env.DEBUG)
      await dumpDebug(hash, candidate.html, candidate.screenshotBase64);
    const antiBot = detectAntiBot(candidate.html);
    if (!antiBot) {
      assets = candidate;
      break;
    }
    lastAntiBot = antiBot;
    if (attempt < MAX_ANTI_BOT_ATTEMPTS) {
      console.error(
        `[scrape] ${fetchSource} blocked by ${antiBot} (attempt ${attempt}/${MAX_ANTI_BOT_ATTEMPTS}) — retrying in 1s`,
      );
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (!assets) {
    console.error(
      `[scrape] ${fetchSource} blocked by ${lastAntiBot} after ${MAX_ANTI_BOT_ATTEMPTS} attempts`,
    );
    return null;
  }
  const hit = await runAdaptersAndJsonLd(url, assets.html);
  if (hit)
    return emit(url, hash, started, hit, assets.fetchDurationMs, fetchSource);
  try {
    const result = await extract(assets.html, assets.screenshotBase64);
    if (isAllNull(result.data)) {
      console.error(`[scrape] ${fetchSource}+claude — all fields null`);
      return null;
    }
    console.error(
      `[scrape] ${fetchSource}+claude — fetch=${assets.fetchDurationMs}ms claude=${result.claudeDurationMs}ms model=${result.model}${result.fallbackUsed ? ' (fallback)' : ''}`,
    );
    return finalizeClaude(
      url,
      hash,
      started,
      result,
      path,
      assets.fetchDurationMs,
      fetchSource,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[scrape] ${fetchSource}+claude failed: ${msg}`);
    return null;
  }
}

export async function scrape(rawUrl: string): Promise<ScrapeResult> {
  const url = normaliseUrl(rawUrl);
  const hash = urlHash(rawUrl);

  const cached = await readCache(hash);
  if (cached) return { source: 'cache', entry: cached };

  const started = Date.now();
  const useZyte = !!process.env.ZYTE_API_KEY && process.env.USE_ZYTE !== '0';

  try {
    // ===== Layer 1a: plain fetch =====
    const initial = await safeFetchHtml(url);
    if (initial) {
      const hit = await runAdaptersAndJsonLd(url, initial.html);
      if (hit)
        return emit(url, hash, started, hit, initial.fetchDurationMs, 'plain');

      // Cheap-Claude short-circuit: if the plain server HTML already yields
      // {product_name, brand, image_url} all non-null, accept it and skip
      // the paid Zyte render. Any Claude error / any of the 3 fields missing
      // → silently fall through to the rendered-fetch path below.
      try {
        const claude = await extract(initial.html, null);
        const { product_name, brand, image_url } = claude.data;
        if (product_name && brand && image_url) {
          console.error(
            `[scrape] plain+claude — fetch=${initial.fetchDurationMs}ms claude=${claude.claudeDurationMs}ms model=${claude.model}${claude.fallbackUsed ? ' (fallback)' : ''}`,
          );
          return finalizeClaude(
            url,
            hash,
            started,
            claude,
            'plain+claude',
            initial.fetchDurationMs,
            'plain',
          );
        }
        const missing = [
          !product_name && 'product_name',
          !brand && 'brand',
          !image_url && 'image_url',
        ]
          .filter(Boolean)
          .join(',');
        console.error(
          `[scrape] plain+claude missing {${missing}} — escalating to rendered fetch`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[scrape] plain+claude failed: ${msg} — escalating to rendered fetch`,
        );
      }
    }

    if (!useZyte) {
      throw new Error(
        'plain_failed_and_zyte_disabled: set ZYTE_API_KEY in .env.local to enable the Zyte fallback',
      );
    }

    // ===== Layer 1b: Zyte HTTP (proxy rotation, no browser) =====
    const httpResult = await tryRenderedSource(
      url,
      hash,
      started,
      async () => {
        const z = await fetchPageViaZyteHttp(url);
        return {
          html: z.html,
          screenshotBase64: null,
          fetchDurationMs: z.fetchDurationMs,
        };
      },
      'zyte+claude',
      'zyte-http',
      3,
    );
    if (httpResult) return httpResult;

    // ===== Layer 1c: Zyte browser (full headless + waitForSelector) =====
    const browserResult = await tryRenderedSource(
      url,
      hash,
      started,
      async () => {
        const z = await fetchPageViaZyteBrowser(url);
        return {
          html: z.html,
          screenshotBase64: null,
          fetchDurationMs: z.fetchDurationMs,
        };
      },
      'zyte+claude',
      'zyte-browser',
      3,
    );
    if (browserResult) return browserResult;
    throw new Error(
      'all_paths_exhausted: plain + zyte-http + zyte-browser all failed',
    );
  } catch (err) {
    const durationMs = Date.now() - started;
    const message = err instanceof Error ? err.message : String(err);
    const entry = failureEntry(url, hash, message, durationMs);
    await writeCache(entry);
    return { source: 'scrape', entry };
  }
}

/** Emit a ScrapeResult for an adapter/JSON-LD hit. */
async function emit(
  url: string,
  hash: string,
  started: number,
  hit: Exclude<ExtractHit, null>,
  fetchDurationMs: number,
  fetchSource: 'plain' | 'zyte-http' | 'zyte-browser',
): Promise<ScrapeResult> {
  if (hit.kind === 'adapter') {
    return finalize(
      url,
      hash,
      started,
      hit.data,
      `adapter:${hit.name}` as ScrapePath,
      fetchDurationMs,
      fetchSource,
      null,
      hit.trace,
    );
  }
  return finalize(
    url,
    hash,
    started,
    hit.data,
    'jsonld',
    fetchDurationMs,
    fetchSource,
    hit.claude,
  );
}

function finalizeClaude(
  url: string,
  hash: string,
  started: number,
  result: ExtractResult,
  path: ScrapePath,
  fetchDurationMs: number,
  fetchSource: 'plain' | 'zyte-http' | 'zyte-browser',
): Promise<ScrapeResult> {
  return finalize(
    url,
    hash,
    started,
    result.data,
    path,
    fetchDurationMs,
    fetchSource,
    result,
  );
}

async function finalize(
  url: string,
  hash: string,
  started: number,
  data: ExtractedProduct,
  path: ScrapePath,
  fetchDurationMs: number,
  fetchSource: 'plain' | 'zyte-http' | 'zyte-browser',
  claudeResult: ExtractResult | null,
  adapterTrace?: Record<string, string>,
): Promise<ScrapeResult> {
  const durationMs = Date.now() - started;
  // Apply domain → brand override last, after all extraction paths. Some sites
  // (e.g. kohler.ca) put the collection in the structured-data brand field and
  // every extractor picks it up wrong — this is the single chokepoint to fix.
  const brandOverride = resolveBrandOverride(url);
  const finalData =
    brandOverride && data.brand !== brandOverride
      ? { ...data, brand: brandOverride }
      : data;
  if (brandOverride && data.brand !== brandOverride) {
    console.error(
      `[brand-override] ${url} → "${data.brand}" → "${brandOverride}"`,
    );
  }
  const entry = successEntry(
    url,
    hash,
    finalData,
    durationMs,
    path,
    fetchSource,
  );
  await writeCache(entry);
  return {
    source: 'scrape',
    entry,
    metrics: {
      path,
      fetchDurationMs,
      fetchSource,
      claudeDurationMs: claudeResult?.claudeDurationMs ?? null,
      inputTokens: claudeResult?.inputTokens ?? null,
      outputTokens: claudeResult?.outputTokens ?? null,
      model: claudeResult?.model ?? null,
      fallbackUsed: claudeResult?.fallbackUsed ?? false,
      ...(adapterTrace ? { adapterTrace } : {}),
    },
  };
}
