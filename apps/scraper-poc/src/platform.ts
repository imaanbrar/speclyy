// Source detection — step 2 of the ingestion pipeline.
//
// Before any extraction runs, classify the URL so the pipeline can route to
// the right strategy. For now "platform" is a loose bucket: it either matches
// one of our adapters (amazon, article, …) or falls through to 'generic'
// which means: try JSON-LD, then ScraperAPI, then Playwright.
//
// Kept as its own module so callers can log/branch on the platform without
// pulling in the full adapter registry.

import { resolveAdapter } from './adapters/index.ts'

export type Platform = string | 'generic'

export function detectPlatform(url: string): Platform {
  const adapter = resolveAdapter(url)
  return adapter?.name ?? 'generic'
}
