# ADR-0013: Bulk crawl design

- **Status:** Accepted
- **Date:** 2026-04-20

## Context

Beyond on-demand scraping (designer pastes one URL), Speclyy needs a way for the admin/tech team to scrape entire brand catalogs to build the global product library. Requirements:

- Schedule a crawl: "scrape all Delta products over the next 10 days"
- Rate-limit requests per domain — must not trigger anti-bot or cause load on vendor sites
- Resumable — if the scraper restarts mid-crawl, it picks up where it left off
- Progress trackable — how many URLs done, success rate, ETA
- Admin trigger without a UI (MVP) — CLI or protected API endpoint
- Logs queryable to review extraction quality

## Decision

**Crawl orchestration:** Inngest cron + fan-out
**URL discovery:** sitemap.xml **and** category-page crawl in parallel (sitemap coverage varies too much to rely on alone); robots.txt respected per `User-Agent: Speclyy/1.0 (+https://speclyy.com/scraper)`
**Persistence:** `crawl_jobs` + `crawl_urls` tables (Postgres)
**Rate limiting:** Inngest domain throttle (8s between requests per domain)
**Admin trigger:** Protected API endpoint (`POST /api/admin/crawl`) — bearer + per-IP rate limit + per-crawl cost ceiling
**Progress check:** `GET /api/admin/crawl/status` (returns JSON)

### Flow

```
1. Admin POSTs to /api/admin/crawl
   → inserts crawl_jobs row (status: discovering)
   → emits crawl/discover event

2. Inngest crawl/discover function:
   → scraper fetches sitemap.xml, parses product URLs
   → scraper crawls category pages for gaps
   → inserts all discovered URLs into crawl_urls (status: pending)
   → updates crawl_jobs.total_urls, status → crawling

3. Inngest cron fires daily at 6am:
   → calculates batch_size = total_urls / duration_days
   → selects next N pending crawl_urls
   → fans out crawl/url.process events (one per URL)

4. Each crawl/url.process:
   → throttled: max 1 per domain per 8s
   → runs Playwright + Claude extraction (same as on-demand)
   → updates crawl_urls.status
   → updates crawl_jobs.processed_urls, succeeded_urls, failed_urls
   → checks whitelist → promotes to global_products if eligible
   → logs to Axiom
```

### Admin API

```
POST /api/admin/crawl
Authorization: Bearer {ADMIN_API_KEY}
Body: { brand, domain, durationDays, rateLimitMs }

GET /api/admin/crawl/status
Authorization: Bearer {ADMIN_API_KEY}
Response: { activeCrawls: [{ brand, status, progress, successRate, eta }] }

POST /api/admin/crawl/:id/pause
POST /api/admin/crawl/:id/resume
```

### Auth hardening

A single bearer token is acceptable for a 1–2 person team only if the blast radius of a leak is bounded. Three gates, all required:

- **Secret storage.** `ADMIN_API_KEY` is a 32-byte random string held in Vercel's secret store. It is never in `.env.example`, never committed. Rotated quarterly or on suspected leak.
- **Per-IP rate limit.** 10 req/min per IP via Vercel KV. A legitimate operator's entire session (start + poll + pause) fits easily.
- **Per-crawl cost ceiling.** `POST /api/admin/crawl` returns `402 Payment Required` when `totalEstimatedUrls × $0.038 > CRAWL_BUDGET_USD` (default $100). Caller must bump the envvar for one-off big crawls.

Together these mean a leaked token caps at ~$100 of damage before Axiom alerts fire. Multi-person admin with per-person keys is on the roadmap (see [roadmap.md](../../roadmap.md)).

### Rate limit rationale

8 seconds between requests per domain:
- 7.5 requests/minute = 450/hour
- Delta ~1,200 products / 10 days = 120/day = 16 minutes of actual scraping/day
- Equivalent to a single human browsing casually — no meaningful load on vendor servers

## Consequences

**Positive**
- Crawl is resumable — `crawl_urls` rows persist; restart picks up `status = 'pending'`
- Progress is queryable without a UI: `GET /api/admin/crawl/status`
- Daily cron approach is gentle — no sudden burst, predictable load on vendor sites
- Domain throttle prevents accidental DDoS even if fan-out sends many events at once
- Same Playwright + Claude pipeline as on-demand — no separate codepath to maintain

**Negative**
- 10-day crawl means waiting 10 days for a full brand catalog. Acceptable — this is a deliberate constraint for rate limiting reasons.
- `crawl_urls` table grows large over time (1,200 rows per crawl × N crawls). Archival/cleanup cron needed post-MVP.
- Admin API is authenticated by a single API key — sufficient for a 1–2 person team, not suitable for a larger team.

## Schema

```sql
CREATE TABLE public.crawl_jobs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand                text NOT NULL,
  domain               text NOT NULL,
  status               text NOT NULL CHECK (status IN (
                         'pending','discovering','crawling','paused','completed','failed')),
  total_urls           int NOT NULL DEFAULT 0,
  processed_urls       int NOT NULL DEFAULT 0,
  succeeded_urls       int NOT NULL DEFAULT 0,
  failed_urls          int NOT NULL DEFAULT 0,
  duration_days        int NOT NULL DEFAULT 10,
  rate_limit_ms        int NOT NULL DEFAULT 8000,
  started_at           timestamptz,
  completed_at         timestamptz,
  estimated_completion timestamptz,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crawl_urls (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_job_id    uuid NOT NULL REFERENCES public.crawl_jobs(id) ON DELETE CASCADE,
  url             text NOT NULL,
  url_hash        text NOT NULL,
  status          text NOT NULL CHECK (status IN (
                    'pending','in_progress','success','failed','skipped')),
  attempts        int NOT NULL DEFAULT 0,
  error_message   text,
  scrape_cache_id uuid REFERENCES public.scrape_cache(id),
  processed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX crawl_urls_job_status_idx ON public.crawl_urls (crawl_job_id, status);
CREATE INDEX crawl_urls_url_hash_idx   ON public.crawl_urls (url_hash);
```

## Alternatives considered

- **Single-run script (no queue)** — Simple `for url of urls: scrape(url)` with a sleep. Rejected because: not resumable on crash, can't pause/adjust rate mid-run, no progress visibility, blocks for hours.
- **Separate cron service (node-cron on Fly.io)** — Would work. Rejected because Inngest already handles cron and eliminates a separate process to manage.
- **Lambda scheduled events (EventBridge)** — AWS-native solution. Rejected — adds AWS as a vendor; same logic as ADR-0010 and ADR-0011 rejections.

## References

- ADR-0010 Scraper host — Fly.io
- ADR-0011 Job queue — Inngest
- ADR-0012 Extraction strategy — Claude API
- ADR-0014 Log store — Axiom (crawl observability)
- [scraper/README.md](../scraper/README.md)
