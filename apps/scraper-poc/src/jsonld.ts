// Fast-path: many product pages ship Schema.org Product data in <script type="application/ld+json">.
// Plain HTTP fetch avoids launching a browser and rarely trips anti-bot (most
// WAFs gate the HTML payload, not simple GETs without JS execution).

export interface JsonLdHit {
  product: unknown  // the raw Product-typed JSON-LD object
  fetchDurationMs: number
}

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export async function tryJsonLd(url: string, timeoutMs = 5_000): Promise<JsonLdHit | null> {
  const started = Date.now()
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept':     'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    })
    if (!res.ok) return null
    const html = await res.text()
    const product = findProduct(html)
    if (!product) return null
    return { product, fetchDurationMs: Date.now() - started }
  } catch {
    return null
  }
}

/**
 * Scan already-fetched HTML for a Schema.org Product JSON-LD block.
 * Exported so the main pipeline can reuse HTML it already fetched for adapter
 * sniffing, instead of re-fetching via `tryJsonLd`.
 */
export function findProductInHtml(html: string): unknown | null {
  return findProduct(html)
}

function findProduct(html: string): unknown | null {
  const blocks = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )
  for (const m of blocks) {
    let parsed: unknown
    try {
      parsed = JSON.parse(m[1]!.trim())
    } catch {
      continue
    }
    const hit = walk(parsed)
    if (hit) return hit
  }
  return null
}

// JSON-LD can be a single object, an array, or use @graph. Walk all shapes.
function walk(node: unknown): unknown | null {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const item of node) {
      const p = walk(item)
      if (p) return p
    }
    return null
  }
  const obj = node as Record<string, unknown>
  if ('@graph' in obj && Array.isArray(obj['@graph'])) {
    const p = walk(obj['@graph'])
    if (p) return p
  }
  const type = obj['@type']
  const isProduct =
    type === 'Product' ||
    (Array.isArray(type) && type.includes('Product'))
  if (isProduct) return obj
  return null
}
