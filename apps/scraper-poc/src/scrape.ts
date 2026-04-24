// Main scrape pipeline — adapter-first, plain → Zyte (one mode by host).
//
// Fetch layers run in order; first usable data wins.
//
//   Layer 1a (free, ~200–500ms): plain HTTP fetch with browser headers.
//     → adapter (Shopify/Amazon/…) → JSON-LD block → cheap Claude pass.
//     Cheap Claude accepts iff product_name AND brand AND image_url are
//     all non-null; partial data falls through. 4xx/5xx/timeout also
//     falls through.
//
//   Layer 1b (paid): Zyte — mode picked by host.
//     - crateandbarrel.* → Zyte browser (proxy endpoint, ~10–30s).
//       Akamai JS challenges need a real browser; the HTTP endpoint
//       and Zyte's datacenter proxy pool both get 403'd.
//     - everything else → Zyte HTTP (REST API endpoint, ~2–5s).
//       Proxy rotation without a browser. Clears IP/TLS blocks
//       (Wayfair, Delta, Rejuvenation). Faster than proxy mode for
//       non-browser fetches — the API short-circuits the CONNECT
//       tunnel round-trip.
//       → If Zyte HTTP fails OR returns partial data (missing any of
//         product_name / brand / image_url), escalate to Zyte browser
//         as a last-resort render. Partial HTTP result is preserved
//         and returned if the browser escalation also fails.
//     Up to 3 retries per Zyte attempt (hard errors + anti-bot pages
//     share the same counter).
//
// Layer 1b only runs if ZYTE_API_KEY is set and USE_ZYTE!=0.
//
// Extraction order inside each fetch layer:
//   i.   Adapters in registry order (matches() first hit wins).
//   ii.  JSON-LD Product block → deterministic normaliser → optional
//        Claude polish (unless USE_CLAUDE_JSONLD=0).
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
 * Critical fields: product_name + brand + image_url. If any of these is
 * missing, the result is considered "partial" and eligible for escalation
 * to a heavier fetch tier. The rest (sku, dimensions, collection,
 * finishes) are nice-to-have but not gating.
 */
function hasCriticalFields(data: ExtractedProduct | null): boolean {
  if (!data) return false;
  return !!data.product_name && !!data.brand && !!data.image_url;
}

/**
 * HEAD-check a URL and return true on 2xx. Used to sanity-check image
 * URLs that Claude produced — it occasionally hallucinates paths or picks
 * stale CDN entries that 404. Short timeout: if the origin is slow to
 * respond we treat the URL as suspect rather than blocking the scrape.
 * Deterministic sources (adapter, raw JSON-LD) bypass this check — their
 * URLs came straight from the page.
 */
async function verifyImageUrl(
  url: string,
  timeoutMs = 5_000,
): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });
    return res.ok;
  } catch {
    return false;
  }
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
  // Fetch with retry. Two failure modes collapse into the same attempt
  // counter:
  //   (a) hard fetch error (timeout / network / 5xx from Zyte itself)
  //   (b) "got HTML but it's an anti-bot page" (Akamai / Cloudflare
  //       challenge that sometimes clears on retry because cookies from
  //       the first response carry, or the edge routes to a different POP)
  // Sleep 1s between attempts.
  const MAX_ATTEMPTS = maxAntiBotAttempts;
  let assets: Awaited<ReturnType<RenderedFetch>> | null = null;
  let lastError: string | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let candidate: Awaited<ReturnType<RenderedFetch>>;
    try {
      candidate = await fetcher();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = `fetch failed: ${msg}`;
      if (attempt < MAX_ATTEMPTS) {
        console.error(
          `[scrape] ${fetchSource} ${lastError} (attempt ${attempt}/${MAX_ATTEMPTS}) — retrying in 1s`,
        );
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      console.error(
        `[scrape] ${fetchSource} ${lastError} — all ${MAX_ATTEMPTS} attempts exhausted`,
      );
      return null;
    }
    if (process.env.DEBUG)
      await dumpDebug(hash, candidate.html, candidate.screenshotBase64);
    const antiBot = detectAntiBot(candidate.html);
    if (!antiBot) {
      assets = candidate;
      break;
    }
    lastError = `blocked by ${antiBot}`;
    if (attempt < MAX_ATTEMPTS) {
      console.error(
        `[scrape] ${fetchSource} ${lastError} (attempt ${attempt}/${MAX_ATTEMPTS}) — retrying in 1s`,
      );
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (!assets) {
    console.error(
      `[scrape] ${fetchSource} ${lastError} after ${MAX_ATTEMPTS} attempts`,
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

export interface ScrapeOptions {
  /** Bypass the cache entirely — always re-run the pipeline. Successful
   *  result still gets written back to cache. */
  noCache?: boolean;
}

export async function scrape(
  rawUrl: string,
  options: ScrapeOptions = {},
): Promise<ScrapeResult> {
  const url = normaliseUrl(rawUrl);
  const hash = urlHash(rawUrl);

  // Only serve successes from cache. Failed entries stay on disk for
  // debugging (overwritten on next run), but a re-extract request always
  // re-runs the pipeline — retrying transient errors is exactly what the
  // user expects when they resubmit.
  if (!options.noCache) {
    const cached = await readCache(hash);
    if (cached && cached.status === 'success') {
      return { source: 'cache', entry: cached };
    }
  }

  const started = Date.now();
  const useZyte = !!process.env.ZYTE_API_KEY && process.env.USE_ZYTE !== '0';

  // Akamai-protected. Zyte HTTP (REST or proxy) both 403 on C&B — only
  // the browser endpoint can resolve the JS challenge. Every other host
  // goes through Zyte HTTP (faster, no browser tax).
  const hostname = new URL(url).hostname.toLowerCase();
  const isCrateAndBarrel = /(^|\.)crateandbarrel\.(com|ca)$/.test(hostname);

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
        const missing = [
          !product_name && 'product_name',
          !brand && 'brand',
          !image_url && 'image_url',
        ]
          .filter(Boolean)
          .join(',');
        if (!missing && image_url) {
          // Verify before short-circuiting — if Claude's image is broken
          // we want to escalate to a rendered fetch rather than return a
          // partial result via this path.
          const imageOk = await verifyImageUrl(image_url);
          if (imageOk) {
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
          console.error(
            `[scrape] plain+claude image URL broken (${image_url}) — escalating to rendered fetch`,
          );
        } else {
          console.error(
            `[scrape] plain+claude missing {${missing}} — escalating to rendered fetch`,
          );
        }
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

    // ===== Layer 1b: Zyte — mode picked by host =====
    if (isCrateAndBarrel) {
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
      throw new Error('all_paths_exhausted: plain + zyte-browser failed');
    }

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
    if (httpResult && hasCriticalFields(httpResult.entry.extractedData)) {
      return httpResult;
    }

    // Escalate to Zyte browser as a last resort. Slow (10–30s per attempt
    // × 3 retries in the worst case) but it's the only way to render JS-
    // heavy pages that Zyte HTTP can't resolve, AND it occasionally pulls
    // fields the HTTP path missed when the site's JSON-LD is thin.
    console.error(
      httpResult
        ? '[scrape] zyte-http returned partial data (missing critical fields) — escalating to zyte-browser'
        : '[scrape] zyte-http failed — escalating to zyte-browser',
    );
    const browserFallback = await tryRenderedSource(
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
    if (browserFallback) return browserFallback;
    // Browser gave us nothing — fall back to the partial HTTP result if we
    // had one rather than failing outright.
    if (httpResult) {
      console.error(
        '[scrape] zyte-browser fallback failed — returning partial zyte-http result',
      );
      return httpResult;
    }
    throw new Error(
      'all_paths_exhausted: plain + zyte-http + zyte-browser failed',
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
  let finalData =
    brandOverride && data.brand !== brandOverride
      ? { ...data, brand: brandOverride }
      : data;
  if (brandOverride && data.brand !== brandOverride) {
    console.error(
      `[brand-override] ${url} → "${data.brand}" → "${brandOverride}"`,
    );
  }
  // Verify Claude-produced image URLs before committing. Adapter and raw
  // JSON-LD paths pass claudeResult=null and skip this — their URLs are
  // deterministic page data. When the URL is broken we null it out; the
  // zyte-http → zyte-browser escalation uses `hasCriticalFields` on the
  // returned entry, so a verified-broken image naturally triggers an
  // escalation rather than returning a result with a dead <img>.
  if (claudeResult !== null && finalData.image_url) {
    const ok = await verifyImageUrl(finalData.image_url);
    if (!ok) {
      console.error(
        `[image-verify] dropping broken Claude URL: ${finalData.image_url}`,
      );
      finalData = { ...finalData, image_url: null };
    }
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
