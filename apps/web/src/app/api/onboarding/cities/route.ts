import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabase } from '@speclyy/auth/server'
import { buildCityLabel } from '@/app/(onboarding)/onboarding/market/_lib/city-label'

/**
 * `/api/onboarding/cities?q=…` — typeahead proxy for the market step.
 *
 * Delegates to the Open-Meteo geocoding API (free, no key required) and
 * returns a flat list of `{ id, label }` rows the client renders directly.
 * Auth-gated: only signed-in users hit this so we don't leak the proxy to
 * the open internet. 5-minute s-maxage keeps repeat queries cheap.
 *
 * Errors are logged with a `[cities]` prefix and surfaced in JSON bodies via
 * a `reason` code so the client can render specific messages instead of a
 * generic "couldn't reach the city service".
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const t0 = Date.now()
  // Unconditional entry log so we always see the route was hit, even if the
  // client aborts before the response.
  console.log('[cities] → GET q=%o', q)
  // If the client disconnects mid-flight, log it instead of leaving the row
  // empty in the dev console.
  request.signal.addEventListener('abort', () => {
    console.warn('[cities] ✕ client aborted after %dms (q=%o)', Date.now() - t0, q)
  })

  let userId: string | null = null
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch (err) {
    console.error('[cities] supabase init/auth failed:', err)
    return NextResponse.json({ error: 'auth_unavailable', reason: 'auth' }, { status: 503 })
  }
  if (!userId) {
    console.warn('[cities] unauthorized (no session cookie)')
    return NextResponse.json({ error: 'unauthorized', reason: 'auth' }, { status: 401 })
  }

  if (q.length < 2) {
    console.warn('[cities] rejected q < 2 chars: %o', q)
    return NextResponse.json(
      { error: 'q must be at least 2 characters', reason: 'q_too_short' },
      { status: 400 },
    )
  }

  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', q)
  url.searchParams.set('count', '8')
  url.searchParams.set('language', 'en')
  url.searchParams.set('format', 'json')

  // Cap the upstream call at 4s — Next dev fetch caching can otherwise hang
  // a slow request indefinitely from the client's POV.
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 4_000)

  let payload: GeocodingResponse
  try {
    const res = await fetch(url, { signal: ctl.signal, next: { revalidate: 300 } })
    if (!res.ok) {
      console.error('[cities] open-meteo non-2xx:', res.status, res.statusText)
      return NextResponse.json({ results: [], reason: 'upstream_error' }, { status: 200 })
    }
    payload = (await res.json()) as GeocodingResponse
  } catch (err) {
    console.error('[cities] open-meteo fetch failed:', err)
    return NextResponse.json({ results: [], reason: 'upstream_unreachable' }, { status: 200 })
  } finally {
    clearTimeout(timer)
  }

  const results = (payload.results ?? []).map((r) => ({
    id: String(r.id),
    label: buildCityLabel({ city: r.name, region: r.admin1, country: r.country_code ?? r.country }),
  }))

  console.log('[cities] ← 200 %d hits in %dms (q=%o)', results.length, Date.now() - t0, q)

  return new NextResponse(JSON.stringify({ results }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, max-age=60, s-maxage=300',
    },
  })
}

interface GeocodingResponse {
  results?: Array<{
    id: number
    name: string
    admin1?: string
    country?: string
    country_code?: string
  }>
}
