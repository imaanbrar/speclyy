// Article.com adapter — https://www.article.com
//
// Article serves a clean SSR page with a schema.org Product JSON-LD block
// plus an og:image meta. Dimensions live in a small table of
// .specs-rows → (.specs-title, .specs-value) pairs that JSON-LD doesn't
// cover. Everything else comes free from structured data.

import { load } from 'cheerio'
import type { Adapter, AdapterResult } from './types.ts'

const HOSTNAMES = /(^|\.)article\.com$/i

const DIMENSION_KEY = /\b(height|width|depth|length|diameter|weight|size|dimension|overall|clearance|seat|leg|arm|back)\b/i

// Shallow schema.org Product shape — we only read the fields we need.
interface SchemaProduct {
  '@type'?: string | string[]
  name?: string
  sku?: string
  mpn?: string
  productID?: string
  image?: string | string[]
  brand?: string | { name?: string }
  url?: string
}

interface SchemaBreadcrumb {
  '@type'?: string | string[]
  itemListElement?: Array<{ name?: string; position?: number }>
}

function textOf($el: ReturnType<ReturnType<typeof load>>): string {
  return ($el.text() ?? '')
    .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function flatten(nodes: unknown): unknown[] {
  // JSON-LD can be a single object, an array, or `{ "@graph": [...] }`.
  if (Array.isArray(nodes)) return nodes.flatMap(flatten)
  if (nodes && typeof nodes === 'object') {
    const graph = (nodes as { '@graph'?: unknown })['@graph']
    if (Array.isArray(graph)) return [...flatten(graph), nodes]
    return [nodes]
  }
  return []
}

function firstOfType<T>(nodes: unknown[], type: string): T | null {
  for (const n of nodes) {
    const t = (n as { '@type'?: string | string[] })['@type']
    if (!t) continue
    if (t === type) return n as T
    if (Array.isArray(t) && t.includes(type)) return n as T
  }
  return null
}

function extractArticle(html: string, url: string): AdapterResult {
  const $ = load(html)
  const trace: Record<string, string> = {}

  // ---------- JSON-LD harvesting ----------
  const ldNodes: unknown[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().first().text()
    if (!raw) return
    try { ldNodes.push(...flatten(JSON.parse(raw))) } catch { /* skip malformed */ }
  })
  const product = firstOfType<SchemaProduct>(ldNodes, 'Product')
  const crumb = firstOfType<SchemaBreadcrumb>(ldNodes, 'BreadcrumbList')

  // ---------- product_name ----------
  let productName: string | null = null
  if (product?.name) { productName = product.name.trim(); trace.product_name = 'jsonld.Product.name' }
  if (!productName) {
    const og = $('meta[property="og:title"]').attr('content')
    if (og) { productName = og.trim(); trace.product_name = 'meta[og:title]' }
  }
  if (!productName) {
    const t = $('title').first().text()
    // Strip " | Article" suffix
    if (t) { productName = t.replace(/\s*\|\s*Article\s*$/i, '').trim(); trace.product_name = '<title>' }
  }

  // ---------- brand ----------
  // Single-brand retailer. JSON-LD `brand` confirms it when present; otherwise
  // hostname is authoritative.
  let brand: string | null = null
  if (product?.brand) {
    brand = typeof product.brand === 'string' ? product.brand : product.brand.name ?? null
    if (brand) trace.brand = 'jsonld.Product.brand'
  }
  if (!brand) { brand = 'Article'; trace.brand = 'hostname' }

  // ---------- collection ----------
  // Article product names start with the line/collection name (e.g. "Heidi …",
  // "Sven …", "Lubek …"). The slug's first segment is a reliable source.
  let collection: string | null = null
  try {
    const path = new URL(url).pathname
    const m = path.match(/\/product\/\d+\/([a-z0-9-]+)/i)
    if (m?.[1]) {
      // First hyphenated token that isn't a number/size.
      const first = m[1].split('-').find(tok => /^[a-z]{3,}$/i.test(tok))
      if (first) {
        collection = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
        trace.collection = 'url-slug'
      }
    }
  } catch { /* ignore */ }

  // ---------- sku ----------
  let sku: string | null = null
  const rawSku = product?.sku ?? product?.mpn ?? product?.productID
  if (rawSku) { sku = String(rawSku).trim(); trace.sku = 'jsonld.Product.sku' }

  // ---------- image_url ----------
  let imageUrl: string | null = null
  if (product?.image) {
    const img = Array.isArray(product.image) ? product.image[0] : product.image
    if (img && /^https?:\/\//.test(img)) { imageUrl = img; trace.image_url = 'jsonld.Product.image' }
  }
  if (!imageUrl) {
    const og = $('meta[property="og:image"]').attr('content')
    if (og && /^https?:\/\//.test(og)) { imageUrl = og; trace.image_url = 'meta[og:image]' }
  }

  // ---------- dimensions ----------
  // Article's spec block: repeated .specs-rows each with .specs-title and
  // .specs-value. Title is a short label, value is a short text like
  // `30"H x 48"-67.75"W x 48"D`.
  const dims: Record<string, string> = {}
  $('.specs-rows').each((_, el) => {
    const $row = $(el)
    const name = textOf($row.find('.specs-title').first())
    const value = textOf($row.find('.specs-value').first())
    if (!name || !value) return
    if (!DIMENSION_KEY.test(name)) return
    const key = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 40)
    if (!key) return
    if (!(key in dims)) dims[key] = value
  })
  const dimensions = Object.keys(dims).length > 0 ? dims : null
  if (dimensions) trace.dimensions = `.specs-rows: ${Object.keys(dims).length} pair(s)`

  return {
    data: {
      product_name: productName,
      brand,
      collection,
      finishes: null,   // TODO: harvest upholstery/fabric options
      sku,
      dimensions,
      image_url: imageUrl,
    },
    trace,
  }
}

export const articleAdapter: Adapter = {
  name: 'article',
  matches(url: string, _html: string): boolean {
    try { return HOSTNAMES.test(new URL(url).hostname) } catch { return false }
  },
  extract: extractArticle,
}
