# Operations & Observability

Platform-wide observability, alerting, SLOs, on-call, and runbooks. The scraper has its own detailed failure tracking in [scraper/failure-tracking.md](scraper/failure-tracking.md) — this doc covers the full system view and everything outside the scraper.

---

## Telemetry stack

| Layer | Tool | What it captures |
|---|---|---|
| Scraper structured logs | Axiom | Scrape attempts, extraction results, failure taxonomy, image uploads |
| Next.js app logs | Axiom (via `@axiomhq/next`) | Server Action errors, Route Handler errors, middleware anomalies |
| Function traces | Vercel | Request durations, cold starts, edge runtime logs |
| DB metrics | Supabase dashboard | Query times, connection pool usage, replication lag |
| Auth metrics | Supabase dashboard | Sign-in rate, token refresh errors, user counts |
| Storage metrics | Supabase dashboard | Bucket sizes, upload/download rates |
| Job queue | Inngest dashboard | Job success/failure rate, retry counts, queue depth |
| Billing events | Stripe dashboard | Webhook delivery, failed payments, MRR, churn |
| Scraper host | Fly.io metrics | CPU, memory, machine health, restart count |

### Axiom log schema

All Speclyy logs share a common envelope:

```ts
{
  _time: string          // ISO timestamp
  service: 'web' | 'scraper' | 'admin'
  level: 'info' | 'warn' | 'error'
  event: string          // e.g. "scrape.started", "webhook.stripe.processed"
  userId?: string        // UUID — never email or name
  traceId?: string       // correlation ID (see below)
  durationMs?: number
  error?: string         // error message, no stack in production
  // event-specific fields...
}
```

---

## Request correlation

A `traceId` (UUID v4) is generated at the browser for each user-initiated action and passed through the full pipeline:

```
Browser → Next.js Server Action (X-Trace-Id header)
       → Inngest event payload (traceId field)
       → Scraper (passed in job data)
       → Axiom logs (traceId field)
```

This lets you reconstruct a full scrape timeline across Next.js, Inngest, and Fly from a single ID in Axiom.

`userId` is logged on all app-layer events so per-user incident investigation is possible without exposing PII. No email, name, or Stripe customer ID in logs.

---

## SLOs / SLIs

| Signal | SLI | SLO target |
|---|---|---|
| App availability | % of requests returning non-5xx | 99.5% / 30d |
| Add-item (cache hit) | % completing < 500ms | 99% |
| Add-item (cache miss / scrape) | % succeeding within 90s | 95% |
| Scrape success rate | % of scrape jobs → status: success | 90% (vendor anti-bot noise) |
| Auth success rate | % of sign-in attempts succeeding | 99% |
| Stripe webhook processing | % processed within 30s of receipt | 99% |
| P95 page load (`/projects/[id]`) | Server response time | < 1.5s |

Error budgets are not formally tracked yet. SLOs are directional targets for MVP.

---

## Dashboards

### Scraper health (Axiom)
- Scrape attempts / success / failure by hour
- Failure breakdown by `error_type` (anti_bot, timeout, claude_error, etc.)
- Top failing domains
- Scrape duration p50 / p95

See [scraper/failure-tracking.md](scraper/failure-tracking.md) for the full Axiom query reference.

### Platform health (Axiom)
- Server Action error rate by action name
- Stripe webhook lag (event timestamp → processed timestamp)
- Admin API call volume

### Billing health (Stripe dashboard)
- MRR, new subscriptions, cancellations
- Failed payment count
- Webhook delivery success rate

### DB health (Supabase dashboard)
- Active connections vs. pool limit
- Slow queries (> 1s)
- Replication lag (if read replicas added later)

### Job queue (Inngest dashboard)
- Job failure rate
- Retry count distribution
- Queue depth

---

## Alerting

Alerts fire to the team Slack channel `#speclyy-alerts`. No PagerDuty yet — Slack + email for MVP.

| Alert | Condition | Severity |
|---|---|---|
| Scraper error rate spike | > 30% failure rate over 15-min window | High |
| Stripe webhook processing failure | Any 5xx on `/api/webhooks/stripe` | High |
| Stripe webhook lag | p95 > 30s over 10-min window | Medium |
| App 5xx spike | > 1% error rate over 5-min window | High |
| DB connection pool saturation | > 80% of pool used | Medium |
| Fly machine restart | Any unexpected restart | Medium |
| Inngest job queue depth | > 500 pending jobs | Medium |
| Scrape cache miss rate | > 80% misses sustained 1h | Low (informational) |

Axiom monitors handle scraper + app alerts. Stripe dashboard handles billing alerts. Fly and Inngest dashboards send their own email alerts.

---

## Runbooks

### Auth outage (Supabase Auth down)

**Symptoms:** All sign-ins fail; middleware `getUser()` returns null for all users.

**Response:**
1. Check [Supabase status page](https://status.supabase.com).
2. If Supabase incident: no action needed on our side. Users are redirected to `/sign-in` (harmless). Existing sessions with valid cookies continue to work until access token expires (~1h).
3. If our Supabase project is isolated: check project health in Supabase dashboard → Logs. Look for connection errors or DB overload.
4. Communicate via status page / Slack if outage > 15 min.

---

### DB degraded / connection storm

**Symptoms:** Slow queries, 5xx on RSC fetches, Supabase connection pool exhausted.

**Response:**
1. Check Supabase dashboard → Database → Connections.
2. If pool saturated: identify long-running transactions in Supabase SQL editor:
   ```sql
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query
   FROM pg_stat_activity
   WHERE state = 'active' AND duration > interval '10 seconds'
   ORDER BY duration DESC;
   ```
3. Kill runaway queries: `SELECT pg_terminate_backend(pid)`.
4. If caused by a deploy: roll back via Vercel instant rollback.
5. If sustained: scale up Supabase compute tier.

---

### Storage outage (Supabase Storage down)

**Symptoms:** Image uploads fail; product images return 404.

**Response:**
1. Check Supabase status.
2. Scraper image re-hosting will fail → scrape jobs log `image_upload_error` and continue (extraction data is still saved without image).
3. User-facing image uploads return an error toast; designer can retry.
4. No automated recovery needed — scraper retries are handled by Inngest.

---

### Stripe webhook backlog

**Symptoms:** Subscription state changes not reflected in app; users incorrectly locked or unlocked.

**Response:**
1. Check Stripe dashboard → Developers → Webhooks → delivery log.
2. If our endpoint is returning 5xx: check Vercel function logs for `/api/webhooks/stripe`.
3. Fix the underlying error and redeploy.
4. Use Stripe dashboard to manually resend failed events after fix is deployed (safe — idempotency dedup handles replays).
5. If Stripe is down: wait for their recovery; they will retry automatically.

---

### Scraper mass failure

See [scraper/failure-tracking.md](scraper/failure-tracking.md) — the scraper doc covers failure taxonomy, admin APIs, and the feedback loop in detail.

Short version:
1. Check Axiom → scraper failure dashboard for dominant `error_type`.
2. `anti_bot`: domain blocking — deprioritise or update stealth headers.
3. `claude_error`: Claude API issue — check Anthropic status; Inngest retries automatically.
4. `timeout`: Playwright pool exhaustion or slow vendor — check Fly metrics for CPU/memory.
5. Inngest dead-letter queue: any jobs that exhausted retries land here for manual review.

---

### Vercel incident

**Symptoms:** App unreachable or returning 502/503.

**Response:**
1. Check [Vercel status](https://www.vercel-status.com).
2. If Vercel incident: no rollback possible; communicate status.
3. If isolated to our deployment: use Vercel dashboard instant rollback to previous deployment.
4. Check if a recent migration caused schema drift — compare migration history vs. expected schema.

---

### Service-role key compromise

**Response (treat as P0):**
1. Immediately rotate the key in Supabase dashboard → Settings → API.
2. Update Vercel env var: `SUPABASE_SECRET_KEY` → new value → redeploy.
3. Update Fly secret: `fly secrets set SUPABASE_SECRET_KEY=<new>`.
4. Audit Axiom logs for anomalous DB writes in the window of compromise.
5. Notify users if any data was accessed or modified by the attacker.

---

## Backup & restore

### Postgres

Supabase provides Point-in-Time Recovery (PITR) on Pro plan. Retention: 7 days (default), configurable.

To restore: Supabase dashboard → Database → Backups → select timestamp.

**Drill cadence:** Restore to a staging project quarterly to verify backup integrity.

### Storage

Supabase Storage does not have automated backup. Product images are re-hostable from vendor URLs (stored in `scrape_cache.url`). PDF exports are user-generated and can be regenerated from spec data. Profile photos are low-value — loss is acceptable.

High-priority: add a periodic export of `scrape_cache` + `global_products` to S3 before launch.

---

## Capacity planning

See [estimated-infra-costs.md](estimated-infra-costs.md) for detailed per-component cost and upgrade triggers.

Key thresholds:
- **Supabase compute**: upgrade when DB connections sustained > 70% of pool.
- **Fly.io scraper**: add a second machine when scrape queue depth sustained > 200 jobs.
- **Inngest**: concurrency limits auto-scale; monitor for throttling in dashboard.
- **Vercel**: function execution limits are per-invocation, not aggregate — no scaling needed at MVP scale.

---

## References

- [scraper/failure-tracking.md](scraper/failure-tracking.md) — scraper-specific observability
- [billing.md](billing.md) — webhook lag metrics, billing health
- [security.md](security.md) — audit logging, incident response, key compromise
- [deployments.md](deployments.md) — rollback, environment promotion
- [estimated-infra-costs.md](estimated-infra-costs.md) — upgrade triggers
