# ADR-0010: Scraper host — Fly.io

- **Status:** Accepted
- **Date:** 2026-04-20

## Context

The scraper service cannot run on Vercel (ADR-0002):
- Vercel has no persistent filesystem — Playwright browser binary can't live there
- 300s max function timeout — anti-bot retries with backoff can exceed this
- No headless Chrome support in Vercel's serverless runtime

We need a host for a long-running Node.js container running Playwright. Requirements:
- Persistent Docker container (no cold start on every scrape)
- Same region as Supabase (us-east-1 / iad) to minimise DB round-trip
- Supports horizontal scaling for bulk crawl bursts
- Low cost for an always-on small instance
- Fast deploys (`fly deploy`)

## Decision

Host the scraper service on **Fly.io** as a persistent Docker container.

```toml
# fly.toml
app = "speclyy-scraper"
primary_region = "iad"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512  # Playwright needs ~400MB per concurrent session

[http_service]
  internal_port = 3001
  auto_stop_machines = false  # keep warm — cold start adds 2-3s
  min_machines_running = 1
```

Scale horizontally when bulk crawl queue backs up: `fly scale count 2`.

## Rationale

**Persistent container.** Playwright browser binary is installed at build time and available on every request — no cold start penalty, no re-downloading. Scraper warm response is ~100ms to first byte; cold start would add 3–5 seconds.

**Same region as Supabase.** Supabase primary is us-east-1. Fly.io `iad` is Washington DC — same AWS region. DB writes (scrape_cache updates, crawl_url status) have <5ms latency. Cross-region DB writes on every scrape would add 80–150ms per job.

**`fly deploy` is fast (~90s).** Scraper changes ship quickly without a full CI pipeline rebuild.

**Cost.** 1 shared CPU + 512MB memory always-on: ~$5–10/month. Second machine during crawl bursts adds another ~$5–10 transiently.

**Docker-native.** Playwright has an official Docker base image (`mcr.microsoft.com/playwright`) with all browser dependencies pre-installed. Zero dependency management.

## Consequences

**Positive**
- Playwright always warm — consistent scrape latency.
- Low-latency DB writes in the same region as Supabase.
- Simple horizontal scale via `fly scale count`.
- Fast deploy cycle.

**Negative**
- Another vendor beyond Vercel and Supabase.
- Fly.io machine occasionally restarts (Fly hardware maintenance) — handled by Inngest retry.
- 512MB may be tight for 5 concurrent Playwright sessions; monitor and upgrade if needed.

## Alternatives considered

- **Railway** — similar Docker-based hosting, slightly simpler UI. Rejected because: no region selection matching Supabase us-east-1, pricing less predictable at sustained load.
- **Render** — persistent services available. Rejected because: spin-down on free tier (cold starts), region options don't align as cleanly with Supabase.
- **AWS ECS Fargate** — familiar, AWS-native. Rejected because: adds AWS as a vendor to a non-AWS stack; Terraform/ALB setup overhead we've already decided to avoid; no cost advantage at this scale.
- **Self-hosted VPS (Hetzner, DigitalOcean)** — cheapest raw compute. Rejected because: manual Docker management, no deploy tooling, ops burden.
