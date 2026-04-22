# Failure Tracking

When scrapes fail, we need to know *why*, at *which domains*, and how often — so we can fix the scraper to cover those cases. This document covers the schema additions, error taxonomy, admin API, Axiom queries, and the feedback loop process.

---

## Why structured failure tracking matters

At MVP, the scraper is the product. A designer who pastes a URL and gets a blank form will churn. Tracking failures tells you:

1. **Which domains fail consistently** → add proxy rotation or custom extraction logic for them
2. **What kind of failure** → anti-bot vs timeout vs Claude parse error — each has a different fix
3. **Success rate trend** → is the scraper getting better or worse after changes?
4. **Blast radius** → are failures isolated to one brand or systemic?

---

## Error taxonomy

Every scrape failure is categorised into one of these types:

| `error_type` | Cause | Fix |
|---|---|---|
| `tos_blocked` | Domain is on `BLOCKED_DOMAINS` list (vendor ToS prohibits automated access). Pre-flight check, fails before Playwright runs. | **Not** a bug — policy enforcement. See [compliance.md](compliance.md). Do not "fix" by rotating proxies or tightening stealth. |
| `anti_bot` | Site detected Playwright (403, Cloudflare challenge, redirect to CAPTCHA) | Add residential proxy rotation for this domain; tighten stealth config |
| `timeout` | Page didn't load within 30s (slow CDN, heavy JS bundle) | Increase timeout for this domain; use `domcontentloaded` instead of `networkidle` |
| `invalid_url` | URL doesn't point to a product page (404, redirect to homepage) | Validate URL shape before enqueueing |
| `claude_error` | Claude returned malformed JSON, refused, or hit rate limit | Improve prompt; add JSON schema validation; retry with Sonnet as fallback |
| `network_error` | Connection refused, DNS failure, SSL error | Transient — auto-retry handles most cases |
| `parse_error` | HTML structure unusual — Claude extracted data but it failed schema validation | Improve Claude prompt for this domain |
| `image_upload_error` | Product image re-hosting to Supabase Storage failed | Transient — retry; save item without image if all retries fail |
| `unknown` | Unclassified exception | Investigate; reclassify after root cause found |

> `tos_blocked` is deliberately surfaced in Axiom alongside other failures so nobody mistakes a policy block for a scraper bug, and so spikes (e.g. a newly blocked domain designers keep pasting) are visible in the same dashboards.

---

## Schema additions to `scrape_cache`

The base `scrape_cache` table (defined in [database.md](../database.md)) has `status`, `error_message`, and `extracted_data`. Add three columns to enable structured failure analysis:

```sql
-- Migration: add failure tracking columns to scrape_cache
ALTER TABLE public.scrape_cache
  ADD COLUMN error_type         text CHECK (error_type IN (
                                  'tos_blocked', 'anti_bot', 'timeout', 'invalid_url',
                                  'claude_error', 'network_error', 'parse_error',
                                  'image_upload_error', 'unknown'
                                )),
  ADD COLUMN attempts           int NOT NULL DEFAULT 0,
  ADD COLUMN last_attempted_at  timestamptz;

CREATE INDEX scrape_cache_error_type_idx ON public.scrape_cache (error_type)
  WHERE error_type IS NOT NULL;

CREATE INDEX scrape_cache_domain_status_idx ON public.scrape_cache (
  (regexp_replace(url, '^https?://(?:www\.)?([^/]+).*', '\1')),
  status
);
```

Updated full schema:

```sql
CREATE TABLE public.scrape_cache (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url_hash            text UNIQUE NOT NULL,
  url                 text NOT NULL,
  status              text CHECK (status IN ('pending','success','failed')),
  extracted_data      jsonb,
  error_message       text,
  error_type          text CHECK (error_type IN (
                        'tos_blocked','anti_bot','timeout','invalid_url','claude_error',
                        'network_error','parse_error','image_upload_error','unknown'
                      )),
  attempts            int NOT NULL DEFAULT 0,
  last_attempted_at   timestamptz,
  scrape_duration_ms  int,
  created_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL DEFAULT (now() + interval '90 days')
);
```

### Drizzle schema

```ts
// lib/db/schema.ts (additions to scrapeCache table)
export const scrapeCacheErrorType = pgEnum('scrape_cache_error_type', [
  'tos_blocked', 'anti_bot', 'timeout', 'invalid_url', 'claude_error',
  'network_error', 'parse_error', 'image_upload_error', 'unknown',
])

// In scrapeCache table definition:
errorType:        scrapeCacheErrorType('error_type'),
attempts:         integer('attempts').notNull().default(0),
lastAttemptedAt:  timestamp('last_attempted_at', { withTimezone: true }),
```

---

## Recording failures in the scraper

```ts
// scraper/lib/failure.ts
export async function recordFailure(
  urlHash: string,
  errorType: ScrapeErrorType,
  errorMessage: string,
) {
  await db
    .update(scrapeCache)
    .set({
      status: 'failed',
      errorType,
      errorMessage,
      attempts: sql`${scrapeCache.attempts} + 1`,
      lastAttemptedAt: new Date(),
    })
    .where(eq(scrapeCache.urlHash, urlHash))
}

// Called in the Inngest function catch block
try {
  const result = await playwrightPool.runScrape(url)
  // ...
} catch (err) {
  const errorType = classifyError(err)  // maps exception type → error_type enum
  await recordFailure(urlHash, errorType, err.message)
  throw err   // re-throw so Inngest handles retries
}
```

```ts
// scraper/lib/classify-error.ts
// NOTE: `tos_blocked` is NOT handled here — it's set by the pre-flight compliance
// check in scrape-url.ts before any exception can occur. See compliance.md.
export function classifyError(err: unknown): ScrapeErrorType {
  const msg = String(err).toLowerCase()
  if (msg.includes('403') || msg.includes('cloudflare') || msg.includes('captcha'))
    return 'anti_bot'
  if (msg.includes('timeout') || msg.includes('timed out'))
    return 'timeout'
  if (msg.includes('404') || msg.includes('not found'))
    return 'invalid_url'
  if (msg.includes('json') || msg.includes('parse'))
    return 'claude_error'
  if (msg.includes('econnrefused') || msg.includes('dns') || msg.includes('ssl'))
    return 'network_error'
  return 'unknown'
}
```

---

## Axiom log schema — failure fields

All scrape events (success and failure) emit to Axiom. Failures include additional fields:

```ts
// On failure — log to Axiom
await axiom.ingest('speclyy-scraper', [{
  service: 'scraper',
  mode: 'on_demand',                 // or 'bulk_crawl'
  event: 'scrape_failed',
  url,
  domain,
  brand,                             // if known from URL
  error_type: errorType,             // structured — directly queryable
  error_message: err.message,        // raw — for debugging
  attempt_number: currentAttempt,
  duration_ms: Date.now() - startedAt,
  user_id,                           // on-demand only
  crawl_job_id,                      // bulk crawl only
}])
```

---

## Axiom failure queries

These are the queries you run when you want to understand and fix scraper failures.

```kusto
// Which domains fail most? — last 7 days
['speclyy-scraper']
| where _time > ago(7d) and event == "scrape_failed"
| summarize
    failures     = count(),
    primary_error = tostring(arg_max(count(), error_type))
  by domain
| order by failures desc
| take 20
```

```kusto
// Error type breakdown — last 30 days
['speclyy-scraper']
| where _time > ago(30d) and event == "scrape_failed"
| summarize count = count() by error_type
| order by count desc
```

```kusto
// Anti-bot failures by domain — these need proxy rotation
['speclyy-scraper']
| where _time > ago(14d)
  and event == "scrape_failed"
  and error_type == "anti_bot"
| summarize failures = count() by domain
| order by failures desc
```

```kusto
// Success rate trend — is the scraper improving?
['speclyy-scraper']
| where _time > ago(30d)
  and event in ("scrape_completed", "scrape_failed")
| summarize
    total     = count(),
    succeeded = countif(event == "scrape_completed"),
    rate      = round(100.0 * countif(event == "scrape_completed") / count(), 1)
  by bin(_time, 1d)
| order by _time asc
```

```kusto
// Claude errors — prompt improvement candidates
['speclyy-scraper']
| where _time > ago(14d)
  and error_type == "claude_error"
| project _time, url, domain, error_message
| order by _time desc
```

---

## Admin API — failure inspection and retry

```bash
# List failed scrapes — last 7 days, grouped by domain
GET /api/admin/scrape/failures?window=7d

# Response
{
  "window": "7d",
  "totalFailed": 87,
  "byDomain": [
    {
      "domain": "kohler.com",
      "failCount": 42,
      "successCount": 3,
      "failureRate": "93%",
      "primaryError": "anti_bot",
      "recommendation": "Add proxy rotation for this domain"
    },
    {
      "domain": "hansgrohe-usa.com",
      "failCount": 12,
      "successCount": 28,
      "failureRate": "30%",
      "primaryError": "timeout",
      "recommendation": "Increase timeout or switch to domcontentloaded"
    }
  ],
  "byErrorType": {
    "anti_bot": 54,
    "timeout": 18,
    "claude_error": 9,
    "unknown": 6
  }
}
```

```bash
# Retry a batch of failed URLs (by domain or error type)
POST /api/admin/scrape/retry
{
  "filter": { "domain": "kohler.com", "errorType": "timeout" },
  "limit": 50
}

# Re-enqueues matching failed scrape_cache entries via Inngest
```

```bash
# Export failed URLs as CSV for investigation
GET /api/admin/scrape/failures/export?domain=kohler.com&format=csv
```

---

## Feedback loop process

The loop from failure → fix → verify:

```
1. DETECT
   Axiom query: "which domains fail most this week?"
   → kohler.com 93% failure rate, error_type = anti_bot

2. DIAGNOSE
   Open a failed URL in a real browser — does it load?
   Check Axiom error_message for the specific block type
   (Cloudflare challenge, JS redirect, CAPTCHA)

3. FIX — choose the right tool
   anti_bot     → add domain to proxy rotation list OR add custom wait/click steps
   timeout      → add domain to extended-timeout list (60s instead of 30s)
   claude_error → test new prompt against HTML samples from this domain
   parse_error  → add domain-specific HTML pre-processing rule

4. RETRY
   POST /api/admin/scrape/retry { "filter": { "domain": "kohler.com" } }
   Watch Axiom: success rate should climb

5. VERIFY
   Axiom query: kohler.com success rate this week vs last week
   Mark fix as resolved in domain config

6. PREVENT
   If anti_bot hits > 20% of a domain → add to monitored-domains list
   Alert when any domain crosses 30% failure rate (Axiom alert)
```

### Domain config file

Accumulate domain-specific scraper settings in a config file rather than hardcoding in the scraper:

```ts
// scraper/config/domains.ts
export const domainConfig: Record<string, DomainConfig> = {
  'kohler.com': {
    timeout: 60_000,              // 60s — heavy JS bundle
    useProxy: true,               // anti-bot protection
    waitUntil: 'domcontentloaded',
    extraDelay: 3000,             // 3s extra wait after load
  },
  'deltafaucet.com': {
    timeout: 30_000,              // default
    useProxy: false,
  },
  'hansgrohe-usa.com': {
    timeout: 45_000,
    waitStrategy: 'selector',    // wait for '[data-product-name]' to appear
    waitSelector: '[data-product-name]',
  },
}

// Falls back to defaults for domains not listed
export function getConfig(domain: string): DomainConfig {
  return domainConfig[domain] ?? DEFAULT_CONFIG
}
```

Every time you fix a domain failure, update this config file. It becomes the institutional knowledge of how each brand's site behaves.

---

## References

- [on-demand.md](on-demand.md) — failure UX (inline editor, retry button)
- [bulk-crawl.md](bulk-crawl.md) — bulk crawl failure handling
- [performance.md](performance.md) — reducing failures via browser pool + stealth
- [../database.md](../database.md) — `scrape_cache` full schema
- [ADR-0014](../adr/0014-log-store.md) — Axiom log store rationale
