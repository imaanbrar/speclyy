/**
 * Render a human-readable label like "Vancouver, British Columbia, Canada".
 * Empty / falsy parts are dropped so we never produce ", , Canada".
 *
 * `country` accepts either a 2-letter ISO code (Open-Meteo's shape) or a full
 * name. We resolve codes to names server-side via Intl.DisplayNames.
 */
export function buildCityLabel(parts: {
  city?: string | null
  region?: string | null
  country?: string | null
}): string {
  const country = expandCountry(parts.country ?? '')
  const out = [parts.city, parts.region, country]
    .map((s) => (s ?? '').toString().trim())
    .filter(Boolean)
  return out.join(', ').replace(/\s+/g, ' ')
}

const REGION_NAMES = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' })
  } catch {
    return null
  }
})()

function expandCountry(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  // Already a full name (anything longer than 3 chars or containing a space).
  if (trimmed.length > 3 || trimmed.includes(' ')) return trimmed
  if (!REGION_NAMES) return trimmed.toUpperCase()
  try {
    return REGION_NAMES.of(trimmed.toUpperCase()) ?? trimmed.toUpperCase()
  } catch {
    return trimmed.toUpperCase()
  }
}
