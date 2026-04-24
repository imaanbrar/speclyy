// Adapter registry — map URL → vendor-specific extractor.
// Keep this list ordered by specificity (most specific first) if we ever add
// overlapping matchers. For now each adapter owns its own hostname family.

import type { Adapter } from './types.ts'
import { amazonAdapter } from './amazon.ts'
import { articleAdapter } from './article.ts'
import { shopifyAdapter } from './shopify.ts'

// Order matters: cheapest + most specific first.
//   - Shopify is API-first (hits a lightweight .json endpoint), works on
//     any domain that's Shopify-powered. Try it before the hostname-pinned
//     HTML adapters so a Shopify-on-a-custom-domain site uses the API path.
//   - Amazon / Article are hostname-pinned HTML adapters.
export const ADAPTERS: Adapter[] = [shopifyAdapter, amazonAdapter, articleAdapter]

/** Hostname-only adapter lookup — used by `detectPlatform` for pre-fetch hints. */
export function resolveAdapter(url: string): Adapter | null {
  for (const a of ADAPTERS) {
    // We can't call matches() here without HTML, so we approximate with
    // hostname-only detection. Pass empty html; HTML-sniffing adapters like
    // Shopify will say no, which is fine — this is only a fast-path hint.
    if (a.matches(url, '')) return a
  }
  return null
}

export type { Adapter, AdapterResult } from './types.ts'
