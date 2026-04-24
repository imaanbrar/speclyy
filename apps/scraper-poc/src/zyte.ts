// Zyte — two implementations, picked per-URL by the caller.
//
// --- fetchPageViaZyteHttp ---------------------------------------------
// Uses Zyte's REST API endpoint (POST https://api.zyte.com/v1/extract
// with httpResponseBody: true). Empirically faster than tunneling the
// same request through the proxy endpoint — the API short-circuits when
// no browser is needed, while the proxy still negotiates a CONNECT
// tunnel + TLS per request.
//
// --- fetchPageViaZyteBrowser ------------------------------------------
// Uses Zyte's proxy endpoint (api.zyte.com:8011) with the
// `Zyte-Browser-Html: true` header. axios handles proxy tunneling per
// the sample in the Zyte docs. Used for Crate & Barrel — the one site
// that needs a real browser because of Akamai JS challenges.
//
// scrape.ts picks which one to call based on hostname — no cross-
// fallback. If the chosen Zyte mode fails, the scrape fails.

import axios, { AxiosError } from 'axios';

const API_ENDPOINT = 'https://api.zyte.com/v1/extract';
const PROXY_HOST = 'api.zyte.com';
const PROXY_PORT = 8011;

export interface ZyteResult {
  html: string;
  fetchDurationMs: number;
}

// =======================================================================
// Implementation 1 — Zyte REST API (HTTP / no browser)
// =======================================================================

interface ZyteApiResponse {
  httpResponseBody?: string; // base64
}

async function callZyteApi(
  body: Record<string, unknown>,
): Promise<ZyteApiResponse> {
  const apiKey = process.env.ZYTE_API_KEY;
  if (!apiKey) throw new Error('ZYTE_API_KEY not set');

  // Williams-Sonoma family sites geoblock EU IPs with a regional error
  // page; pin egress country when configured.
  if (process.env.ZYTE_GEOLOCATION) {
    body.geolocation = process.env.ZYTE_GEOLOCATION;
  }

  const res = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
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
  return (await res.json()) as ZyteApiResponse;
}

export async function fetchPageViaZyteHttp(url: string): Promise<ZyteResult> {
  const started = Date.now();
  const payload = await callZyteApi({ url, httpResponseBody: true });
  if (!payload.httpResponseBody) {
    throw new Error('Zyte response missing httpResponseBody');
  }
  const html = Buffer.from(payload.httpResponseBody, 'base64').toString(
    'utf-8',
  );
  return { html, fetchDurationMs: Date.now() - started };
}

// =======================================================================
// Implementation 2 — Zyte Proxy (browser-rendered)
// =======================================================================

function proxyConfig() {
  const apiKey = process.env.ZYTE_API_KEY;
  if (!apiKey) throw new Error('ZYTE_API_KEY not set');
  return {
    protocol: 'http' as const,
    host: PROXY_HOST,
    port: PROXY_PORT,
    auth: { username: apiKey, password: '' },
  };
}

export async function fetchPageViaZyteBrowser(
  url: string,
): Promise<ZyteResult> {
  const started = Date.now();
  const headers: Record<string, string> = { 'Zyte-Browser-Html': 'true' };
  if (process.env.ZYTE_GEOLOCATION) {
    headers['Zyte-Geolocation'] = process.env.ZYTE_GEOLOCATION;
  }

  try {
    const res = await axios.get<string>(url, {
      headers,
      proxy: proxyConfig(),
      timeout: 90_000,
      responseType: 'text',
      // Surface Zyte's error body in the thrown message instead of
      // axios's generic "Request failed with status code N".
      validateStatus: () => true,
    });
    if (res.status < 200 || res.status >= 300) {
      const body = typeof res.data === 'string' ? res.data.slice(0, 500) : '';
      throw new Error(`Zyte ${res.status}: ${body}`);
    }
    return { html: res.data, fetchDurationMs: Date.now() - started };
  } catch (err) {
    if (err instanceof AxiosError) {
      throw new Error(`Zyte request failed: ${err.message}`);
    }
    throw err;
  }
}
