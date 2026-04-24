// Per-vendor product extractors — the "adapter" pattern.
//
// Each adapter knows one vendor's DOM deeply and returns the same shape the
// generic Claude path returns. Goal: on sites we care about most, sidestep
// generic extraction entirely. On everything else, fall through to Claude.
//
// Adapters are PURE — they take a raw HTML string + URL and return a result.
// Fetching is not the adapter's job; the pipeline hands us the HTML.

import type { ExtractedProduct } from '../schema.ts'

export interface AdapterResult {
  /** Partial extraction; null fields are left for downstream logic. */
  data: Partial<ExtractedProduct>
  /** Per-field trace for debugging — which selector/path each value came from. */
  trace: Record<string, string>
}

export interface Adapter {
  /** Short identifier, e.g. 'amazon', 'shopify'. Used in logs. */
  name: string
  /**
   * Decide whether this adapter handles the request. HTML is passed so
   * platform-based adapters (e.g. Shopify, which runs on arbitrary domains)
   * can sniff for platform markers rather than relying on hostname alone.
   * Hostname-only adapters (Amazon, Article) can ignore the `html` arg.
   */
  matches(url: string, html: string): boolean
  /**
   * Run extraction. May make additional fetches (e.g. Shopify's `.json`
   * sibling endpoint), which is why this is async.
   */
  extract(html: string, url: string): Promise<AdapterResult> | AdapterResult
}
