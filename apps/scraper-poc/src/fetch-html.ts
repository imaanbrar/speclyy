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

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Upgrade-Insecure-Requests': '1',
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
