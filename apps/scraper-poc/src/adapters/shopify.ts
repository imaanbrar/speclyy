// Shopify API adapter — API-first extraction for any Shopify-powered store.
//
// Every Shopify product page has a sibling `.json` endpoint that returns
// the canonical product record. Shape is stable across stores:
//   https://brand.com/products/{handle}        ← HTML
//   https://brand.com/products/{handle}.json   ← JSON (what this adapter hits)
//
// Detection uses the INITIAL-FETCH HTML — we look for Shopify platform
// markers (`Shopify.shop`, `cdn.shopify.com`, `shopify-features` meta).
// This works on custom domains (not just *.myshopify.com) because most
// brands white-label Shopify but still embed the same runtime markers.

import { load } from 'cheerio'
import type { Adapter, AdapterResult } from './types.ts'
import type { ExtractedProduct } from '../schema.ts'

// HTML markers that reliably indicate a Shopify-powered store. Any one hit
// is enough. Order: fastest-to-hit first.
const SHOPIFY_MARKERS = [
  'cdn.shopify.com',
  'Shopify.shop',
  'Shopify.theme',
  '/cdn/shop/',
  '"shopify-features"',
]

// Path shapes that carry a Shopify product handle.
//   /products/<handle>          (canonical)
//   /collections/<c>/products/<handle>   (scoped to a collection — still valid)
const HANDLE_RE = /\/products\/([^/?#]+)/i

// Regexes used to best-effort recover dimensions from body_html. Shopify has
// no schema for dimensions — merchants just put them in the description. We
// fish for "30\"H x 48\"W x 48\"D" and "<th>Width</th><td>24 in</td>" style.
const DIM_LABEL = /\b(height|width|depth|length|diameter|weight|size|dimension|overall|seat|leg|arm)\b/i
const INLINE_DIMS_RE = /(\d+(?:\.\d+)?)\s?["″]?\s*([HWD])\b/gi

// Keys that count as "color/finish/material" in Shopify option schemas.
const FINISH_KEY = /\b(color|colour|finish|material|fabric|wood|metal)\b/i

interface ShopifyImage {
  src: string
  width?: number
  height?: number
  position?: number
}

interface ShopifyVariant {
  sku?: string | null
  title?: string
  price?: string
  option1?: string | null
  option2?: string | null
  option3?: string | null
}

interface ShopifyOption {
  name: string
  position?: number
  values: string[]
}

interface ShopifyProduct {
  id: number
  title: string
  handle: string
  vendor?: string
  product_type?: string
  body_html?: string
  tags?: string | string[]
  images?: ShopifyImage[]
  variants?: ShopifyVariant[]
  options?: ShopifyOption[]
}

function isShopifyHtml(html: string): boolean {
  // Fast scan — avoid building a DOM just to check for markers.
  for (const m of SHOPIFY_MARKERS) {
    if (html.includes(m)) return true
  }
  return false
}

function originOf(url: string): string | null {
  try { return new URL(url).origin } catch { return null }
}

function handleOf(url: string): string | null {
  try {
    const path = new URL(url).pathname
    const m = path.match(HANDLE_RE)
    return m?.[1] ?? null
  } catch { return null }
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Best-effort dimension recovery from body_html.
 *
 * Shopify doesn't standardize dimensions, so merchants put them wherever —
 * prose, <dl>, <table>, bullet lists. We try two strategies:
 *   1. DOM pass: cheerio over body_html, look for dim-label/value pairs in
 *      standard spec markup (<th>/<td>, <dt>/<dd>, <li> with "Label: value").
 *   2. Prose pass: regex for inline "30\"H x 48\"W" shapes, pull into discrete
 *      keys.
 */
function extractDimensionsFromBodyHtml(bodyHtml: string | undefined): Record<string, string> | null {
  if (!bodyHtml) return null

  const dims: Record<string, string> = {}

  // --- strategy 1: DOM label/value pairs ---
  try {
    const $ = load(`<root>${bodyHtml}</root>`)
    const pairs: Array<[string, string]> = []

    // <th>label</th><td>value</td>
    $('tr').each((_, tr) => {
      const cells = $(tr).find('th, td')
      if (cells.length !== 2) return
      pairs.push([$(cells[0]).text().trim(), $(cells[1]).text().trim()])
    })

    // <dt>label</dt><dd>value</dd>
    $('dl').each((_, dl) => {
      const dts = $(dl).find('dt')
      const dds = $(dl).find('dd')
      const n = Math.min(dts.length, dds.length)
      for (let i = 0; i < n; i++) {
        pairs.push([$(dts[i]).text().trim(), $(dds[i]).text().trim()])
      }
    })

    // <li>Label: value</li>
    $('li').each((_, li) => {
      const t = $(li).text().trim()
      const m = t.match(/^([^:]{1,50}):\s*(.+)$/)
      if (m) pairs.push([m[1].trim(), m[2].trim()])
    })

    for (const [name, value] of pairs) {
      if (!name || !value) continue
      if (name.length > 80 || value.length > 300) continue
      if (!DIM_LABEL.test(name)) continue
      const key = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 40)
      if (!key) continue
      if (!(key in dims)) dims[key] = value
    }
  } catch { /* ignore malformed body_html */ }

  // --- strategy 2: prose pass for inline "X\"H" tokens ---
  if (Object.keys(dims).length === 0) {
    const prose = stripHtml(bodyHtml)
    const inline: Record<string, string> = {}
    INLINE_DIMS_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = INLINE_DIMS_RE.exec(prose)) !== null) {
      const [, num, axis] = m
      const axisKey = axis.toUpperCase() === 'H' ? 'height' : axis.toUpperCase() === 'W' ? 'width' : 'depth'
      if (!(axisKey in inline)) inline[axisKey] = `${num}"`
    }
    Object.assign(dims, inline)
  }

  return Object.keys(dims).length > 0 ? dims : null
}

function pickBestImage(images: ShopifyImage[] | undefined): string | null {
  if (!images || images.length === 0) return null
  // Prefer position=1, otherwise the widest image.
  const byPosition = images.find(i => i.position === 1)
  if (byPosition?.src) return byPosition.src
  const byWidth = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]
  return byWidth?.src ?? null
}

function pickFinishes(options: ShopifyOption[] | undefined, variants: ShopifyVariant[] | undefined): string[] | null {
  if (!options || options.length === 0) return null
  // First option whose name looks like color/finish/material.
  const match = options.find(o => FINISH_KEY.test(o.name))
  if (match?.values && match.values.length > 0) {
    return match.values.map(v => v.trim()).filter(Boolean)
  }
  // Fallback: if variants have option1 and there's no "Color"/"Finish" header,
  // but it's a single-option product (likely a finish), use those values.
  if (options.length === 1 && variants && variants.length > 1) {
    const uniq = Array.from(new Set(variants.map(v => v.option1).filter(Boolean))) as string[]
    if (uniq.length > 0) return uniq
  }
  return null
}

async function extractShopify(html: string, url: string): Promise<AdapterResult> {
  const origin = originOf(url)
  const handle = handleOf(url)
  const trace: Record<string, string> = {}

  if (!origin || !handle) {
    return {
      data: emptyData(),
      trace: { _error: 'no shopify handle in URL' },
    }
  }

  const apiUrl = `${origin}/products/${handle}.json`
  const res = await fetch(apiUrl, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'speclyy-poc/0.1' },
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    return {
      data: emptyData(),
      trace: { _error: `shopify api ${res.status} at ${apiUrl}` },
    }
  }

  const body = (await res.json()) as { product?: ShopifyProduct }
  const p = body.product
  if (!p) {
    return {
      data: emptyData(),
      trace: { _error: 'shopify api returned no `product` key' },
    }
  }

  // ---------- product_name ----------
  const productName = p.title?.trim() || null
  if (productName) trace.product_name = 'shopify.product.title'

  // ---------- brand ----------
  let brand: string | null = null
  if (p.vendor) { brand = p.vendor.trim(); trace.brand = 'shopify.product.vendor' }

  // ---------- collection ----------
  // product_type is the merchant-chosen category ("Sofas", "Pendant Lights").
  // On many D2C stores this doubles as the "collection" concept.
  let collection: string | null = null
  if (p.product_type) { collection = p.product_type.trim(); trace.collection = 'shopify.product.product_type' }

  // ---------- sku ----------
  let sku: string | null = null
  const firstVariantSku = p.variants?.[0]?.sku?.trim()
  if (firstVariantSku) { sku = firstVariantSku; trace.sku = 'shopify.variants[0].sku' }

  // ---------- image_url ----------
  let imageUrl: string | null = null
  const bestImg = pickBestImage(p.images)
  if (bestImg) { imageUrl = bestImg; trace.image_url = 'shopify.images[]' }

  // ---------- finishes ----------
  const finishes = pickFinishes(p.options, p.variants)
  if (finishes) trace.finishes = 'shopify.options[color|finish]'

  // ---------- dimensions (best-effort regex over body_html) ----------
  const dimensions = extractDimensionsFromBodyHtml(p.body_html)
  if (dimensions) trace.dimensions = 'shopify.body_html (regex)'

  return {
    data: {
      product_name: productName,
      brand,
      collection,
      finishes,
      sku,
      dimensions,
      image_url: imageUrl,
    },
    trace,
  }
}

function emptyData(): Partial<ExtractedProduct> {
  return {
    product_name: null, brand: null, collection: null, finishes: null,
    sku: null, dimensions: null, image_url: null,
  }
}

export const shopifyAdapter: Adapter = {
  name: 'shopify',
  matches(url: string, html: string): boolean {
    if (!handleOf(url)) return false   // URL must contain /products/<handle>
    return isShopifyHtml(html)
  },
  extract: extractShopify,
}
