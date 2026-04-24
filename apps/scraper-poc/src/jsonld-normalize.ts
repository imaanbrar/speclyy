// Deterministic normalizer for Schema.org Product JSON-LD.
//
// Handles the common shape variations so we don't have to spend a Claude
// call when the data is already well-formed. Gaps (dimensions, finishes,
// collection) get left null — callers can choose whether to escalate to
// Claude or accept partial data via USE_CLAUDE_JSONLD.
//
// Known variations handled:
//   - brand: string | { "@type": "Brand", "name": string }
//   - image: string | string[] | { url | @id | contentUrl }
//   - sku / mpn fallback
//   - width/height/depth/length/diameter: string | number |
//       { value, unitCode }  with UN/CEFACT code translation (INH→in, etc.)

import type { ExtractedProduct } from './schema.ts';

// UN/CEFACT Recommendation 20 codes. JSON-LD Product shops in these
// because Schema.org examples do. Anything unknown falls through as the
// raw code so the data isn't silently wrong.
const UNIT_CODE_MAP: Record<string, string> = {
  INH: 'in',
  FOT: 'ft',
  YRD: 'yd',
  MMT: 'mm',
  CMT: 'cm',
  MTR: 'm',
  LBR: 'lb',
  GRM: 'g',
  KGM: 'kg',
};

function asString(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const t = x.trim();
  return t.length > 0 ? t : null;
}

function normaliseBrand(x: unknown): string | null {
  if (typeof x === 'string') return asString(x);
  if (x && typeof x === 'object') {
    return asString((x as Record<string, unknown>).name);
  }
  return null;
}

function normaliseImage(x: unknown): string | null {
  if (typeof x === 'string') return asString(x);
  if (Array.isArray(x)) {
    for (const item of x) {
      const r = normaliseImage(item);
      if (r) return r;
    }
    return null;
  }
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    return (
      asString(o.url) ?? asString(o['@id']) ?? asString(o.contentUrl)
    );
  }
  return null;
}

function normaliseQuantitative(v: unknown): string | null {
  if (typeof v === 'string') return asString(v);
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const raw = o.value ?? o.minValue;
  if (raw === undefined || raw === null) return null;
  const num =
    typeof raw === 'number' && Number.isFinite(raw)
      ? String(raw)
      : asString(raw);
  if (!num) return null;
  const unitCode = asString(o.unitCode);
  const unitText = asString(o.unitText);
  const unit = unitCode ? (UNIT_CODE_MAP[unitCode] ?? unitCode) : unitText;
  return unit ? `${num} ${unit}` : num;
}

function normaliseDimensions(
  product: Record<string, unknown>,
): Record<string, string> | null {
  const dims: Record<string, string> = {};
  for (const key of ['width', 'height', 'depth', 'length', 'diameter']) {
    const val = normaliseQuantitative(product[key]);
    if (val) dims[key] = val;
  }
  return Object.keys(dims).length > 0 ? dims : null;
}

const EMPTY: ExtractedProduct = {
  product_name: null,
  brand: null,
  collection: null,
  finishes: null,
  sku: null,
  dimensions: null,
  image_url: null,
};

export function normaliseJsonLd(product: unknown): ExtractedProduct {
  if (!product || typeof product !== 'object') return { ...EMPTY };
  const o = product as Record<string, unknown>;
  return {
    product_name: asString(o.name),
    brand: normaliseBrand(o.brand),
    // `collection` and `finishes` aren't standardized in Schema.org Product
    // — they hide in `isPartOf`, `hasVariant`, `additionalProperty`, or
    // site-custom keys. Leave to Claude (or null if disabled).
    collection: null,
    finishes: null,
    sku: asString(o.sku) ?? asString(o.mpn),
    dimensions: normaliseDimensions(o),
    image_url: normaliseImage(o.image),
  };
}
