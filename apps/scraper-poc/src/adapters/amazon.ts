// Amazon adapter — handles amazon.com / .ca / .co.uk / etc. product pages.
//
// Why a dedicated adapter: Amazon hides the real image URL behind attributes
// that generic HTML pruning strips (`data-old-hires`, `data-a-dynamic-image`).
// Likewise, spec data lives in a set of well-known element IDs that Claude
// sometimes gets right and sometimes doesn't — this adapter makes it
// deterministic.

import { load } from 'cheerio'
import type { Adapter, AdapterResult } from './types.ts'

const AMAZON_HOSTNAMES = /(^|\.)amazon\.(com|ca|co\.uk|de|fr|it|es|com\.au|co\.jp|in|com\.mx|com\.br|com\.tr|sg|ae|nl|pl|se)$/i

// Matches Amazon ASINs — 10-char alphanumeric, appears in /dp/<ASIN> or /gp/product/<ASIN>.
const ASIN_RE = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i

// Keys that count as dimension-ish in the detail-bullets table. Mirrors the
// list we used in the (now-deleted) browser extension.
const DIMENSION_KEY = /\b(height|width|depth|length|diameter|weight|size|dimension|overall|spout|deck|spread|clearance)\b/i

function textOf($el: ReturnType<ReturnType<typeof load>>): string {
  return ($el.text() ?? '')
    .replace(/[\u200E\u200F\u202A-\u202E]/g, '')  // bidi/zero-width marks
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Parse Amazon's `data-a-dynamic-image` JSON blob and return the URL whose
 * recorded width is largest. Returns null if the attr is missing/malformed.
 */
function bestDynamicImage(raw: string | undefined): string | null {
  if (!raw) return null
  try {
    const obj = JSON.parse(raw) as Record<string, [number, number]>
    let bestUrl: string | null = null
    let bestWidth = -1
    for (const [url, dims] of Object.entries(obj)) {
      const w = Array.isArray(dims) ? Number(dims[0]) : 0
      if (w > bestWidth) { bestWidth = w; bestUrl = url }
    }
    return bestUrl
  } catch {
    return null
  }
}

function extractAmazon(html: string, url: string): AdapterResult {
  const $ = load(html)
  const trace: Record<string, string> = {}

  // ---------- product_name ----------
  const productName = textOf($('#productTitle').first()) || null
  if (productName) trace.product_name = '#productTitle'

  // ---------- brand ----------
  // `#bylineInfo` text is usually "Visit the Foo Store" or "Brand: Foo".
  // Detail-bullets row is more reliable when present.
  let brand: string | null = null
  const bylineText = textOf($('#bylineInfo').first())
  if (bylineText) {
    const m = bylineText.match(/(?:Visit the\s+|Brand:\s*)?(.+?)(?:\s+Store)?$/i)
    if (m?.[1]) { brand = m[1].trim(); trace.brand = '#bylineInfo' }
  }
  // Look for a "Brand" row in the detail-bullets list.
  if (!brand) {
    $('#detailBullets_feature_div li, #productDetails_detailBullets_sections1 tr').each((_, el) => {
      const $el = $(el)
      const label = textOf($el.find('.a-text-bold').first()) || textOf($el.find('th').first())
      if (!/^brand/i.test(label)) return
      const value = textOf($el.find('.a-text-bold').first().next()) || textOf($el.find('td').first())
      if (value) { brand = value.replace(/^[:\s]+/, ''); trace.brand = 'detailBullets: Brand'; return false }
    })
  }

  // ---------- sku (ASIN) ----------
  let sku: string | null = null
  const asinMatch = url.match(ASIN_RE)
  if (asinMatch?.[1]) { sku = asinMatch[1].toUpperCase(); trace.sku = 'url:/dp/ASIN' }
  if (!sku) {
    // fallback: hidden input or data attr somewhere on the page
    const input = $('input#ASIN').attr('value') || $('[data-asin]').first().attr('data-asin')
    if (input && /^[A-Z0-9]{10}$/i.test(input)) {
      sku = input.toUpperCase()
      trace.sku = 'input#ASIN'
    }
  }

  // ---------- image_url ----------
  let imageUrl: string | null = null
  const $landing = $('#landingImage').first()
  // 1. data-old-hires — the full-resolution URL Amazon hides from scrapers
  const oldHires = $landing.attr('data-old-hires')
  if (oldHires && /^https?:\/\//.test(oldHires)) {
    imageUrl = oldHires; trace.image_url = '#landingImage[data-old-hires]'
  }
  // 2. data-a-dynamic-image JSON blob — pick the widest URL
  if (!imageUrl) {
    const dyn = bestDynamicImage($landing.attr('data-a-dynamic-image'))
    if (dyn) { imageUrl = dyn; trace.image_url = '#landingImage[data-a-dynamic-image]' }
  }
  // 3. plain src on the main image
  if (!imageUrl) {
    const src = $landing.attr('src')
    if (src && /^https?:\/\//.test(src)) { imageUrl = src; trace.image_url = '#landingImage[src]' }
  }
  // 4. og:image as last-ditch
  if (!imageUrl) {
    const og = $('meta[property="og:image"], meta[name="og:image"], meta[name="twitter:image"]').first().attr('content')
    if (og && /^https?:\/\//.test(og)) { imageUrl = og; trace.image_url = 'meta[og:image]' }
  }

  // ---------- dimensions ----------
  // Harvest (label → value) pairs from every known Amazon spec container,
  // then filter to dimension-ish keys.
  const pairs: Array<[string, string]> = []
  const pushPair = (n: string, v: string) => {
    n = n.replace(/[:\s]+$/g, '').trim()
    v = v.trim()
    if (!n || !v) return
    if (n.length > 80 || v.length > 300) return
    pairs.push([n, v])
  }

  // Detail bullets (list format)
  $('#detailBullets_feature_div li').each((_, el) => {
    const spans = $(el).find(':scope > span > span')
    if (spans.length === 2) pushPair(textOf(spans.eq(0)), textOf(spans.eq(1)))
  })
  // productDetails_detailBullets_sections1 (th/td table)
  $('#productDetails_detailBullets_sections1 tr, #productDetails_techSpec_section_1 tr, #productDetails_techSpec_section_2 tr').each((_, el) => {
    const th = $(el).find('th').first()
    const td = $(el).find('td').first()
    if (th.length && td.length) pushPair(textOf(th), textOf(td))
  })
  // prodDetails table (alternate layout)
  $('#prodDetails tr').each((_, el) => {
    const th = $(el).find('th').first()
    const td = $(el).find('td').first()
    if (th.length && td.length) pushPair(textOf(th), textOf(td))
  })

  const dims: Record<string, string> = {}
  for (const [n, v] of pairs) {
    if (!DIMENSION_KEY.test(n)) continue
    const key = n.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 40)
    if (!key) continue
    if (!(key in dims)) dims[key] = v  // first-win
  }
  const dimensions = Object.keys(dims).length > 0 ? dims : null
  if (dimensions) trace.dimensions = `detailBullets: ${Object.keys(dims).length} pair(s)`

  return {
    data: {
      product_name: productName,
      brand,
      collection: null,         // not a concept on Amazon listings
      finishes: null,           // TODO: parse variation_color_name swatches
      sku,
      dimensions,
      image_url: imageUrl,
    },
    trace,
  }
}

export const amazonAdapter: Adapter = {
  name: 'amazon',
  matches(url: string, _html: string): boolean {
    try {
      return AMAZON_HOSTNAMES.test(new URL(url).hostname)
    } catch {
      return false
    }
  },
  extract: extractAmazon,
}
