// Zyte API — two fetch modes.
// https://docs.zyte.com/zyte-api/reference/http.html
//
// Both modes share the same proxy-rotation + anti-bot infrastructure; they
// differ only in whether Zyte spins up a browser.
//
//   fetchPageViaZyteHttp     (httpResponseBody, ~2-5s):
//     Raw HTTP fetch through Zyte's proxy pool. No JS execution, no page
//     render. Clears most IP/TLS-fingerprint blocks (Wayfair, Delta,
//     Rejuvenation) at a fraction of the browser cost. Fails on sites
//     that ship empty client-hydrated markup or interstitial JS challenges.
//
//   fetchPageViaZyteBrowser  (browserHtml, ~10-30s):
//     Real headless Chrome with scriptable actions. Required for Akamai/
//     PerimeterX JS challenges (Crate & Barrel, Kohler) and client-
//     hydrated JSON-LD (West Elm, Rejuvenation). We pair it with a
//     `waitForSelector` action on non-empty JSON-LD so Zyte blocks until
//     the real payload shows up instead of returning the challenge page.

const ENDPOINT = 'https://api.zyte.com/v1/extract';

export interface ZyteResult {
  html: string;
  fetchDurationMs: number;
}

interface ZyteAction {
  action: 'waitForSelector';
  selector: { type: 'css'; value: string; state?: 'attached' | 'visible' };
  timeout?: number;
  onError?: 'return' | 'fail';
}

interface ZyteRequestBody {
  url: string;
  browserHtml?: boolean;
  httpResponseBody?: boolean;
  actions?: ZyteAction[];
  geolocation?: string;
}

interface ZyteResponse {
  url?: string;
  statusCode?: number;
  browserHtml?: string;
  httpResponseBody?: string; // base64
}

async function callZyte(body: ZyteRequestBody): Promise<ZyteResponse> {
  const apiKey = process.env.ZYTE_API_KEY;
  if (!apiKey) throw new Error('ZYTE_API_KEY not set');

  // Optional egress-country pin. Williams-Sonoma family sites geoblock EU
  // IPs with a "not available in your region" page; set ZYTE_GEOLOCATION
  // to a two-letter ISO code (US / CA / GB / ...) if you hit that.
  if (process.env.ZYTE_GEOLOCATION) body.geolocation = process.env.ZYTE_GEOLOCATION;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      // HTTP Basic: API key as username, empty password.
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Zyte ${res.status}: ${text.slice(0, 500)}`);
  }
  return (await res.json()) as ZyteResponse;
}

export async function fetchPageViaZyteHttp(url: string): Promise<ZyteResult> {
  const started = Date.now();
  const payload = await callZyte({ url, httpResponseBody: true });
  if (!payload.httpResponseBody) throw new Error('Zyte response missing httpResponseBody');
  const html = Buffer.from(payload.httpResponseBody, 'base64').toString('utf-8');
  return { html, fetchDurationMs: Date.now() - started };
}

export async function fetchPageViaZyteBrowser(url: string): Promise<ZyteResult> {
  const started = Date.now();
  const payload = await callZyte({
    url,
    browserHtml: true,
    // `:not(:empty)` short-circuits instantly on server-rendered sites;
    // on Akamai-challenged or client-hydrated sites it blocks until the
    // real JSON-LD appears. `onError: 'return'` lets pages without any
    // JSON-LD still return the rendered HTML instead of failing.
    actions: [{
      action: 'waitForSelector',
      selector: { type: 'css', value: 'script[type="application/ld+json"]:not(:empty)' },
      timeout: 10,
      onError: 'return',
    }],
  });
  if (!payload.browserHtml) throw new Error('Zyte response missing browserHtml');
  return { html: payload.browserHtml, fetchDurationMs: Date.now() - started };
}
