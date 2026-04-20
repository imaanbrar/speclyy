# ADR-0011: Job queue — Inngest

- **Status:** Accepted
- **Date:** 2026-04-20

## Context

Both scraper modes (on-demand and bulk crawl) need a job queue that:
- Decouples Next.js from the scraper service (Vercel can't wait 30s for Playwright)
- Retries failed jobs with backoff
- Rate-limits requests **per domain** (critical for bulk crawl — don't hammer vendor sites)
- Fans out 1,000+ URLs for a bulk crawl without overwhelming the scraper
- Provides step isolation — if Claude extraction fails, Playwright doesn't re-run
- Works natively with Vercel serverless functions (no persistent connections)
- Has a dev dashboard for debugging scrape failures

## Decision

Use **Inngest** as the job queue.

Deployed as a Next.js Route Handler (`/api/webhooks/inngest`). Functions registered on the scraper service listen for events.

Key Inngest features used:

**Step isolation** — each phase is an independently retriable step:
```ts
const { html } = await step.run('playwright-scrape', () => runPlaywright(url))
const extracted = await step.run('claude-extract', () => extractWithClaude(html))
await step.run('persist', () => updateCache(extracted))
```

**Domain-level throttle** for bulk crawl:
```ts
{
  throttle: {
    key: 'event.data.domain',
    count: 1,
    period: '8s',  // max 1 request per domain per 8 seconds
  }
}
```

**Fan-out** for bulk crawl batches:
```ts
await step.sendEvent('fan-out', urls.map(u => ({
  name: 'crawl/url.process',
  data: { url: u.url, domain: u.domain, crawlJobId },
})))
```

**Cron** for daily batch processing:
```ts
{ cron: '0 6 * * *' }  // pick next N URLs from crawl_urls each morning
```

## Rationale

**Step isolation is the most important feature.** On-demand scrapes have three expensive steps: Playwright (5–30s, risk of anti-bot retry), Claude extraction (1–3s, API cost), and DB write. If any step fails, only that step retries. Without step isolation, a Claude API timeout would re-run Playwright — wasting time and risking triggering anti-bot detection again.

**Domain throttle is non-negotiable for bulk crawl.** Inngest's `throttle` with a domain key enforces `max 1 request per domain per N seconds` across all concurrent workers. Other queues (SQS, BullMQ) would require a separate rate limiter service (Redis token bucket) to achieve the same. Inngest makes it a one-liner.

**No Redis to manage.** BullMQ requires Redis — another managed service, more ops, more billing. At MVP, eliminating Redis is meaningful.

**Vercel-native.** Inngest registers as a Route Handler — `POST /api/webhooks/inngest`. Vercel receives the webhook, processes it as a normal serverless function. No persistent connection, no WebSocket, no special networking.

**Dev server is a genuine DX win.** `npx inngest-cli@latest dev` runs a local Inngest server that shows every event, every step, every retry in a browser UI. Debugging a scrape failure means opening `localhost:8288` and seeing exactly which step failed and why.

**Cost.** Inngest free tier: 100k events/month, unlimited steps. Paid: $50/mo for 5M events. At MVP volume (500 on-demand + 2,400 bulk/month), free tier covers it for months.

## Consequences

**Positive**
- Step isolation prevents expensive steps from re-running on downstream failures.
- Domain throttle enforces rate limits without a Redis token bucket.
- No Redis to provision or maintain.
- Dev dashboard makes scrape debugging fast.
- Cron built-in for daily batch processing.

**Negative**
- Inngest is a third-party vendor — if it goes down, scraping stops. Mitigated by Inngest's SLA and the fact that on-demand scraping can degrade gracefully to manual entry.
- Event payload size limit (512KB) — HTML can be large. Mitigation: pass the `scrape_cache_id` (not the HTML) between steps; Playwright writes HTML to the cache table, Claude reads it from there.
- `throttle` key is per-Inngest-app, not per-Fly.io instance — correct behaviour, but worth understanding.

## Alternatives considered

- **BullMQ + Redis** — Excellent queue library, step-like behaviour via job chains, dead-letter queues. Rejected because: requires managed Redis (~$15/mo), no built-in domain throttle (need separate rate limiter), no cron without a separate scheduler.
- **AWS SQS + Lambda** — Mature, highly reliable, AWS-native. Rejected because: adds AWS as a vendor; SQS has no step isolation (one message = one job, chaining is manual); Lambda cold starts add latency; no dev dashboard.
- **Trigger.dev** — Similar to Inngest, step functions, Vercel-compatible. Rejected because: slightly less mature, smaller community, less documentation. Revisit if Inngest has pricing or reliability issues.
- **Temporal** — Industry-standard durable workflow engine. Rejected because: heavy operational overhead (Temporal server to manage), complex SDK, designed for multi-hour workflows. Our longest job is 5 minutes — overkill.
