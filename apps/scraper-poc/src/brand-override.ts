// Domain → brand override.
//
// Some single-brand retailer sites confuse extractors — e.g. Kohler's product
// pages put the collection name ("Anthem®") in the structured-data `brand`
// field, and Zyte's AI picks it up as the brand. Since these domains only
// sell one brand, we can safely override with a known-good value.
//
// Only add domains that are confirmed single-brand. Never add multi-brand
// retailers (wayfair.com, homedepot.com, amazon.com, etc.).

const DOMAIN_TO_BRAND: Record<string, string> = {
  'kohler.com':           'Kohler',
  'kohler.ca':            'Kohler',
  'deltafaucet.com':      'Delta',
  'rejuvenation.com':     'Rejuvenation',
  'rejuvenationhome.ca':  'Rejuvenation',
  'article.com':          'Article',
}

export function resolveBrandOverride(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    return DOMAIN_TO_BRAND[hostname] ?? null
  } catch {
    return null
  }
}
