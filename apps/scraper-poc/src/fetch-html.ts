// Plain HTML fetch with realistic browser headers.
//
// Many retailer sites 403 on bare `fetch()` but serve product pages fine to
// anything that looks like a real desktop browser. This is our cheapest
// fetch path — used by platform adapters before falling back to ScraperAPI
// or Playwright.

export interface FetchResult {
  html: string
  status: number
  fetchDurationMs: number
  finalUrl: string
}

// Mirror what Chrome 131 on macOS sends for a top-level navigation. The
// sec-ch-ua / Sec-Fetch-* bundle is cheap to spoof and defeats lightweight
// edge checks that look for "no client hints = bot"; anything heavier
// (Akamai Bot Manager, Cloudflare Turnstile, PerimeterX) still falls
// through to Zyte. Keep this in sync with the UA version if bumped.
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Upgrade-Insecure-Requests': '1',
  'sec-ch-ua':
    '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  // `none` is what Chrome sends for URL-bar navigations and bookmarks —
  // the closest analog to how we're fetching (no referrer chain).
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
}

export async function fetchHtml(url: string, timeoutMs = 30_000): Promise<FetchResult> {
  const started = Date.now()
  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  })
  const html = await res.text()
  return {
    html,
    status: res.status,
    fetchDurationMs: Date.now() - started,
    finalUrl: res.url,
  }
}
