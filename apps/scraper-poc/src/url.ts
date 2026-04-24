import { createHash } from 'node:crypto'

const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'ref', 'ref_src', 'fbclid', 'gclid', 'mc_cid', 'mc_eid',
]

export function normaliseUrl(raw: string): string {
  const u = new URL(raw)
  for (const p of TRACKING_PARAMS) u.searchParams.delete(p)
  u.hash = ''
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.slice(0, -1)
  }
  u.hostname = u.hostname.toLowerCase()
  return u.toString()
}

export function urlHash(raw: string): string {
  return createHash('sha256').update(normaliseUrl(raw)).digest('hex')
}
