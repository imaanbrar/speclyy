# Estimated Infrastructure Costs — 500 Designers (MVP)

All prices in USD. Verified April 2026. Shows what Speclyy pays per month at steady-state MVP scale.

---

## Usage model assumptions

These drive the cost estimate. Change any number and scale the Claude API cost proportionally — everything else is nearly flat.

| Assumption | Value | Reasoning |
|---|---|---|
| Total registered designers | 500 | Target MVP milestone |
| Monthly active designers | 300 (60%) | Typical SaaS activation rate |
| URL pastes per active designer/month | ~10 | 2 active projects × 20 items × 25% URL paste rate |
| Total URL paste events/month | **3,000** | 300 × 10 |
| Scrape cache hit rate | ~25% | Early MVP — limited global library, grows over time |
| **Live scrapes/month (on-demand)** | **~2,250** | 3,000 × 75% |
| Bulk crawl (one-time per brand) | ~1,200 URLs | Delta-scale catalog |

> **Conservative floor:** if cache hit rate is 0% (all pastes go to live scrape), total = 3,000 scrapes/month. I use this as the ceiling in estimates below.

---

## Component breakdown

### Vercel Pro — $20/month

| Metric | Usage | Limit | Status |
|---|---|---|---|
| Bandwidth | ~60 GB | 1 TB | ✅ Comfortable |
| Function invocations | ~500k | 1M included | ✅ Within range |
| Seats | 1 developer | Per-seat billing | ✅ |

No overage risk at 500 designers. The $20/month Pro plan is the ceiling.

---

### Supabase Pro — $25/month

| Metric | Usage | Limit | Status |
|---|---|---|---|
| MAU | 500 | 100,000 | ✅ Well clear |
| Database storage | ~1–2 GB | 8 GB | ✅ Clear |
| File storage (images) | ~2–4 GB after 6 months¹ | **100 GB** | ✅ Clear |
| Bandwidth | ~60 GB | 250 GB | ✅ Clear |
| Realtime connections | ~50 concurrent | 500 | ✅ Clear |

¹ 2,250 scrapes/month × ~200 KB avg product image = ~450 MB new storage/month. At month 6: ~2.7 GB. Nowhere near 100 GB.

No overage risk at MVP. Supabase Pro is more than enough.

---

### Fly.io (Scraper container) — ~$8/month

One always-on machine: `shared-cpu-1x`, 1 GB RAM (needed for browser pool of 4 pages).

| Resource | Monthly cost |
|---|---|
| shared-cpu-1x | ~$2/month |
| 1 GB RAM | ~$6/month |
| Network egress (~2 GB) | ~$0.04 |
| **Total** | **~$8/month** |

Scale to 2 machines during active bulk crawl: ~$16/month for that period.

---

### Claude API — variable (the dominant cost)

**Pricing (claude-opus-4-5, April 2026):**
- Input: **$5.00 / million tokens**
- Output: **$25.00 / million tokens**

> ⚠️ ADR-0012 referenced old claude-3-opus pricing ($15/$75 per MTok). Current claude-opus-4-5 is 3× cheaper. The $0.06/scrape estimate in the ADR is now ~$0.04. The decision to use Opus remains correct — the cost concern is lower than documented.

**Per-scrape token estimate:**

| Input component | Tokens | Reasoning |
|---|---|---|
| System prompt + instructions | ~300 | Fixed |
| Truncated HTML (15k chars) | ~5,000 | ~3 chars/token avg for HTML |
| Product page screenshot (1280×800 WebP) | ~1,365 | width×height / 750 |
| **Total input** | **~6,665** | |
| **Output (JSON fields)** | **~200** | 7 fields, structured JSON |

**Cost per scrape:**

| Model | Input cost | Output cost | **Total/scrape** |
|---|---|---|---|
| claude-opus-4-5 | 6,665 × $5/MTok = $0.033 | 200 × $25/MTok = $0.005 | **~$0.038** |
| claude-sonnet-4-5 | 6,665 × $3/MTok = $0.020 | 200 × $15/MTok = $0.003 | **~$0.023** |

**Monthly Claude cost at 3,000 live scrapes (conservative, 0% cache hit):**

| Model | Cost/scrape | Monthly (3k scrapes) |
|---|---|---|
| Opus | $0.038 | **~$115** |
| Sonnet | $0.023 | **~$70** |

**Monthly Claude cost at 2,250 live scrapes (realistic, 25% cache hit):**

| Model | Cost/scrape | Monthly (2.25k scrapes) |
|---|---|---|
| Opus | $0.038 | **~$86** |
| Sonnet | $0.023 | **~$52** |

**Bulk crawl one-time cost per brand:**

| Brand size | Opus | Sonnet |
|---|---|---|
| Delta (~1,200 URLs) | $0.038 × 1,200 = **$46** | $0.023 × 1,200 = **$28** |
| Kohler (~800 URLs) | **$30** | **$18** |

---

### Inngest — $0/month (free tier)

| Metric | Usage | Free limit | Status |
|---|---|---|---|
| Function executions/month | ~15,000¹ | 50,000 | ✅ Well clear |
| Concurrent steps | 5 (our limit) | 5 | ✅ Exactly matches |
| Log retention | 3 days | 3 days | ⚠️ See note |

¹ 2,250 scrapes × 5 Inngest steps each + cron overhead ≈ 11,500–15,000 executions.

**Note on 3-day log retention:** Inngest logs are for function-level debugging. Business-critical scrape logs (success rate, field completeness, cost tracking) live in Axiom with 30-day retention. The 3-day Inngest limit is acceptable for MVP.

**Upgrade trigger:** Inngest Pro is $75/month. Delay this until executions consistently approach 50k/month — approximately 3,000+ active designers at current usage rates.

---

### Axiom — $0/month (free tier)

| Metric | Usage | Free limit | Status |
|---|---|---|---|
| Log ingest/month | ~5 MB | 500 GB | ✅ Nowhere close |
| Retention | 30 days needed | 30 days included | ✅ Perfect fit |
| Query compute | Minimal | 10 GB-hours | ✅ Clear |

Axiom's free tier was specifically chosen because it covers the full 10-day bulk crawl retention window. Will not need a paid plan until far beyond MVP.

---

### Resend (transactional email) — $0/month (free tier)

| Use case | Volume/month | Free limit |
|---|---|---|
| Welcome / onboarding | ~50 new users | 3,000/month |
| Trial expiry warnings | ~100 | |
| Billing notifications | ~50 | |
| **Total** | **~200** | ✅ Well clear |

---

### Domain — ~$1/month

`speclyy.com` at ~$15/year = $1.25/month. Rounded to $1.

---

## Summary

### Monthly infrastructure cost at 500 designers

| Component | Cost | Notes |
|---|---|---|
| Vercel Pro | $20 | Fixed |
| Supabase Pro | $25 | Fixed |
| Fly.io (scraper) | $8 | Fixed |
| Claude API — **Opus** | **$86–115** | Variable (scrape volume) |
| Claude API — **Sonnet** | **$52–70** | After A/B test validates quality |
| Inngest | $0 | Free tier |
| Axiom | $0 | Free tier |
| Resend | $0 | Free tier |
| Domain | $1 | Fixed |

| Scenario | Monthly total | Per designer |
|---|---|---|
| **Opus, realistic (25% cache hit)** | **~$140** | **$0.28** |
| **Opus, conservative (0% cache hit)** | **~$169** | **$0.34** |
| **Sonnet, realistic** | **~$106** | **$0.21** |
| **Sonnet, conservative** | **~$124** | **$0.25** |

---

## Unit economics

Assuming Speclyy charges **$25/designer/month**:

| Metric | Value |
|---|---|
| Monthly revenue (500 designers) | $12,500 |
| Infrastructure cost (Opus, realistic) | $140 |
| **Infra as % of revenue** | **1.1%** |
| Infrastructure cost (Sonnet) | $106 |
| **Infra as % of revenue (Sonnet)** | **0.8%** |
| Infrastructure cost per paying designer | ~$0.28 |
| Revenue per designer | $25.00 |
| **Gross margin before infra** | ~**98.9%** |

The model is extremely infra-efficient. Claude API is the only meaningful variable cost — everything else is near-fixed.

---

## What drives cost up

Almost all cost scaling comes from **Claude API scrape volume**. At 10× scale (5,000 designers), only Claude grows meaningfully:

| Component | 500 designers | 5,000 designers | Note |
|---|---|---|---|
| Vercel | $20 | $40–60 | Bandwidth/invocation overage |
| Supabase | $25 | $25–50 | Storage addon if images grow |
| Fly.io | $8 | $16–25 | Add 2nd machine for concurrency |
| Claude (Opus) | $140 | ~$1,400 | Linear with scrapes |
| Claude (Sonnet) | $106 | ~$700 | |
| Inngest | $0 | $75 | Upgrade to Pro at ~3k active designers |
| Axiom | $0 | $25 | Upgrade to paid at high ingest volume |

---

## Upgrade triggers — when to spend more

| Trigger | Action | Cost delta |
|---|---|---|
| Claude cost > $400/month | A/B test Sonnet vs Opus on 20% of traffic | −40% Claude cost |
| Inngest executions > 45k/month (~3k active designers) | Upgrade to Inngest Pro | +$75/month |
| Scrapes > 10k/month consistently | Scale Fly.io to 2 machines | +$8/month |
| Supabase storage > 80 GB | Add storage ($0.021/GB above 100 GB) OR migrate to R2 (see [ADR-0009](adr/0009-storage.md)) | Minimal until 100 GB hit |
| Vercel bandwidth > 800 GB | Upgrade or enable CDN for images | Rare at 5k designers |

---

## Cost reduction levers (ranked by impact)

| Lever | Potential saving | Effort |
|---|---|---|
| **Switch Opus → Sonnet** | −40% Claude cost | Validate quality with 500-scrape A/B test |
| **Raise cache hit rate** (more bulk crawls) | −25–50% Claude cost | More bulk crawls of popular brands |
| **HTML pruning improvements** | −10–20% per-scrape token count | Better DOM selector logic in scraper |
| **Claude prompt caching** | −50% on repeated system prompt | Add Anthropic cache-control headers (10% of input cost for cached tokens) |
| **Batch API** | −50% all Claude costs | Inngest already async; route low-priority scrapes to Batch API |

### Prompt caching detail

Anthropic supports prompt caching: mark the system prompt + HTML as cacheable. Repeat requests to the same Claude session reuse the cached input at 10% of the normal input price. Our scrape prompt is different every time (different HTML), so standard caching doesn't apply — but the system instructions portion (~300 tokens) can be cached.

Savings: 300 tokens × $5/MTok × 90% savings × 3,000 scrapes = $4/month. Minimal — not worth prioritising.

### Batch API detail

Inngest jobs are already async. Routing on-demand scrapes through Claude's Batch API (50% price discount, results within 24h) is not acceptable for the on-demand UX. But **bulk crawl** jobs have no latency requirement — routing the daily 120-URL batch through Batch API saves 50% on that portion.

Bulk crawl savings: 1,200 URLs/brand × $0.038 × 50% = $23 saved per brand crawl. Add `async_mode: 'batch'` flag to bulk crawl Inngest function when the batch hit rate matters.

---

## Stripe (billing processing — not infra, shown for completeness)

Stripe charges per transaction, not a monthly fee.

| Metric | Value |
|---|---|
| Per-transaction fee | 2.9% + $0.30 |
| Per designer at $25/month | $0.725 + $0.30 = **$1.025/transaction** |
| 500 paying designers/month | **~$513/month** |
| As % of revenue | **4.1%** |

Stripe is 4× more expensive than your entire infrastructure bill. This is normal for SaaS — it's the cost of managed payments.

---

## References

- [ADR-0002 — Vercel hosting](adr/0002-hosting-platform.md)
- [ADR-0004 — Supabase](adr/0004-postgres-host.md)
- [ADR-0009 — Storage (R2 migration trigger)](adr/0009-storage.md)
- [ADR-0010 — Fly.io scraper host](adr/0010-scraper-host.md)
- [ADR-0012 — Claude extraction](adr/0012-extraction-strategy.md) *(note: pricing in ADR reflects old claude-3-opus rates; current claude-opus-4-5 is ~3× cheaper)*
- [ADR-0014 — Axiom log store](adr/0014-log-store.md)
- [scraper/performance.md](scraper/performance.md) — cache hit rate improvement strategies
