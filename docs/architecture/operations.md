# Operations & Observability

> **Status:** stub — outline only.

Platform-wide observability, alerting, SLOs, on-call, and runbooks. The scraper has its own detailed observability story under [scraper/failure-tracking.md](scraper/failure-tracking.md) — this doc covers everything else and the unified view.

## Scope

- Metrics, logs, traces across Next.js, scraper, DB, Stripe
- Alerting + on-call
- SLOs / SLIs
- Runbooks for common incidents

## Outline

### 1. Telemetry stack
- Axiom (scraper + app logs)
- Vercel logs + Web Analytics
- Supabase metrics (DB, auth, storage)
- Stripe dashboard / webhook events
- Fly metrics (scraper host)

### 2. Correlation
- Request IDs end-to-end (browser → Next.js → Inngest → scraper)
- User ID / session propagation
- Trace format

### 3. SLOs / SLIs
- App availability
- Add-item success rate (cache hit + miss)
- Scrape success rate
- Auth success rate
- Webhook processing lag
- P95 page load

### 4. Dashboards
- Platform health (Axiom)
- Scraper health — cross-link to scraper docs
- Billing health (webhook lag, failed payments)
- DB health (slow queries, connection pool)

### 5. Alerting
- What pages vs. what just notifies
- Thresholds + burn-rate alerts
- Routing (Slack / email / PagerDuty?)

### 6. On-call
- Rotation (once team > 1)
- Escalation
- Ownership by subsystem

### 7. Runbooks
Each a short doc linked from here:
- Auth outage (Supabase Auth down)
- DB degraded / connection storm
- Storage outage
- Stripe webhook backlog
- Scraper mass-failure (→ scraper docs)
- Vercel incident
- Inngest outage

### 8. Backup & restore
- Supabase PITR settings
- Storage bucket backup
- Restore drill cadence

### 9. Capacity planning
- Cross-ref [estimated-infra-costs.md](estimated-infra-costs.md)
- Upgrade triggers

## Cross-references
- [scraper/failure-tracking.md](scraper/failure-tracking.md)
- [security.md](security.md) — audit logs, incident response
- [deployments.md](deployments.md)
