# ADR-0014: Log store — Axiom

- **Status:** Accepted
- **Date:** 2026-04-20

## Context

The scraper service (on-demand + bulk crawl) needs structured observability. At MVP there is no admin UI — the log store **is** the admin interface. Requirements:

- Ingest structured JSON logs from Fly.io (scraper) and Vercel (Next.js API routes)
- Queryable: success rate by domain, field completeness per crawl, error patterns
- Retention: must outlast a 10-day bulk crawl (logs from Day 1 must exist when crawl completes)
- Low cost at MVP volume (~15,000 log events/month, ~15MB)
- DX: developer familiar with Azure Monitor KQL / CloudWatch should be productive quickly
- Acts as a scratchpad admin screen without requiring a frontend to be built

## Decision

Use **Axiom** as the structured log store.

- Scraper service: `@axiomhq/js` for direct HTTP ingest
- Next.js: `next-axiom` for automatic server log capture + manual event logging
- Dataset: `speclyy-scraper` (all scrape events in one dataset, differentiated by `mode` and `event` fields)

## Rationale

**APL is effectively KQL with minor differences.** The team has Azure Monitor / Log Analytics experience. APL uses the same pipeline syntax (`| where`, `| summarize`, `| extend`, `| order by`, `ago()`, `bin()`). The transition is ~1 hour, not a new language. CloudWatch Logs Insights uses a different syntax (`filter`/`stats`) and requires `parse` for JSON fields — a step backwards from what the team knows.

**Structured JSON is native.** Axiom ingests JSON and makes every field immediately queryable without `parse` statements. CloudWatch requires CloudWatch EMF or explicit `parse` regex to query nested JSON fields — adding friction for our log schema.

**30-day free retention** covers the full 10-day crawl + 20-day review window on the free tier. BetterStack's free tier offers only 3 days — Day 1 crawl logs would be gone before the crawl finishes.

**Free tier volume headroom.** 500GB/month ingest on the free tier. Our MVP volume is ~15MB/month. We won't pay for log storage for a very long time.

**Vercel log drain.** `next-axiom` + one environment variable captures all Next.js server logs (API route invocations, Server Action errors, middleware logs) automatically. Gives free visibility into the admin API endpoint calls alongside scraper logs.

**Acts as admin screen.** Axiom's dashboard UI — saved queries, charts, alerts — provides the admin observability layer without building any frontend. When we eventually build a proper admin screen in Next.js, we can query Axiom via their API to embed the same analytics.

### Sample queries (using team's KQL knowledge)

```kusto
// Success rate by domain — this week
['speclyy-scraper']
| where _time > ago(7d) and mode == "bulk_crawl"
| summarize
    total = count(),
    succeeded = countif(status == "success"),
    rate = round(100.0 * countif(status == "success") / count(), 1)
  by domain
| order by total desc

// Average field completeness — Delta crawl
['speclyy-scraper']
| where brand == "Delta" and mode == "bulk_crawl"
| summarize avg_completeness = avg(completeness_pct) by bin(_time, 1d)

// Claude cost tracker
['speclyy-scraper']
| where _time > ago(30d)
| summarize
    total_input_tokens  = sum(claude_input_tokens),
    total_output_tokens = sum(claude_output_tokens),
    est_cost_usd = sum(claude_input_tokens) * 0.000015
                 + sum(claude_output_tokens) * 0.000075
  by bin(_time, 1d)
```

### Log schema

```ts
// On-demand scrape
{
  service: 'scraper', mode: 'on_demand', event: 'scrape_completed',
  url, domain, brand, status,
  fields_extracted: string[],
  fields_missing: string[],
  completeness_pct: number,       // fields_extracted.length / 7 * 100
  duration_ms: number,
  claude_input_tokens: number,
  claude_output_tokens: number,
  playwright_duration_ms: number,
  retry_count: number,
  user_id, item_id,
}

// Bulk crawl URL
{
  service: 'scraper', mode: 'bulk_crawl', event: 'url_processed',
  crawl_job_id, url, domain, brand, status,
  completeness_pct, duration_ms, promoted_to_global: boolean,
}

// Crawl job lifecycle
{
  service: 'scraper', mode: 'bulk_crawl',
  event: 'crawl_started' | 'crawl_completed' | 'batch_processed',
  crawl_job_id, brand, total_urls,
  processed_so_far, success_rate_pct,
}
```

## Consequences

**Positive**
- KQL-familiar team productive in Axiom within an hour.
- No `parse` commands — structured JSON queryable immediately.
- 30-day free retention outlasts a 10-day crawl comfortably.
- Axiom dashboard = admin screen without building one.
- Vercel log drain captures Next.js server logs automatically.
- Claude cost tracking built into the log schema — no separate billing dashboard needed.

**Negative**
- APL lacks some KQL features: no `render` inline charts (UI-based instead), no `let` variables, limited cross-dataset joins, no `mv-expand`. None of these affect our current query patterns.
- Logs field `fields_extracted` is a string array — can't `mv-expand` in APL. Workaround: log `fields_extracted_count` as an integer alongside the array.
- Axiom is a third-party vendor — log history tied to their platform. Mitigated by export API if we ever need to move.

## Alternatives considered

- **BetterStack (Logtail)** — SQL-like queries, uptime monitoring included. Rejected because: free tier is 3-day retention — crawl Day 1 logs expire before a 10-day crawl finishes; paid plan ($25/mo) required from the start.
- **AWS CloudWatch Logs Insights** — Familiar to the team. Rejected because: JSON field queries require `parse` statements; adds AWS as a vendor on a non-AWS stack; slower UI; `filter`/`stats` syntax is a step back from KQL.
- **Azure Monitor Logs (KQL)** — Best query language, team knows it. Rejected because: requires Azure subscription + Log Analytics Workspace provisioning; Azure Portal is noticeably slower than Axiom's UI; adds Azure as a vendor to a Vercel + Supabase + Fly.io stack.
- **Datadog** — Best-in-class for distributed tracing + APM. Rejected because: $50–200/month at meaningful usage, 1-day free retention, designed for larger teams. Overkill for two services and one developer.
- **Grafana Cloud (Loki)** — Very generous free tier (10GB/month, 14-day retention), LogQL is powerful. Rejected for MVP because: requires configuring a log shipper (Promtail or Alloy) on Fly.io; steeper setup than Axiom's HTTP ingest; UI has a higher learning curve. Good revisit option post-MVP.

## References

- ADR-0010 Scraper host — Fly.io
- ADR-0013 Bulk crawl design
- [scraper.md](../scraper.md)
