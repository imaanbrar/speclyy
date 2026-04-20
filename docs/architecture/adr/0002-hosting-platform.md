# ADR-0002: Hosting platform — Vercel

- **Status:** Accepted
- **Date:** 2026-04-20

## Context

ADR-0001 commits us to Next.js. We need a host. The realistic options for a Next.js app are:

- **Vercel** — managed Next.js by the team that builds Next.js.
- **Docker on ECS Fargate or Azure Container Apps** — run `next start` in a container behind ALB / Front Door.
- **OpenNext → AWS Lambda + S3 + CloudFront** — split Next's output across native AWS primitives.

All three support the full Next.js feature set. The choice comes down to setup cost, ongoing ops burden, pricing at MVP scale, and lock-in risk.

Speclyy is built by a solo developer (plus one future collaborator) with prior AWS/Azure experience. The constraint that dominates is developer hours, not dollars.

### Pricing at MVP scale (rough — ~50 designers, ~500 GB bandwidth/month)

| Option | Monthly baseline |
|---|---|
| Vercel Pro | ~$20 |
| AWS Fargate + ALB + CloudFront | ~$60–90 |
| Azure Container Apps (scale-to-zero) | ~$15–40 |
| OpenNext on AWS | ~$15–30 |

Delta is under $70/month — noise compared to the 20–40 hours required to stand up a production-ready AWS/Azure deployment.

## Decision

Use **Vercel (Pro plan)** as the hosting platform for the Next.js app.

Preserve portability:
- The app ships with a working `Dockerfile` from day one.
- **No Vercel-specific primitives.** We will not use Vercel KV, Edge Config, or Vercel Blob. All stateful infra lives in Supabase (DB, auth, storage), Stripe, or the scraper service.
- Middleware and Server Actions stay within the Next.js-standard API surface.

## Rationale

**Time-to-ship beats raw infra cost at MVP.** Setting up Fargate properly (Terraform, ALB, autoscaling, GitHub Actions → ECR, CloudWatch, log aggregation, preview environments via ephemeral task defs) is 20–40 hours. Vercel is `git push`. Every hour saved goes to the scraper, catalog seeding, or design-partner calls.

**Zero ops drag.** No SSL renewals, no task definition drift, no CI pipeline maintenance, no log quota tuning. Vercel handles it.

**Preview deploys per PR.** Automatic, free, shareable URLs. For a solo dev this replaces "ask a reviewer" with "click the link and try it." Also useful for sharing WIP with design partners.

**Next.js feature parity day-one.** New Next.js releases ship working on Vercel immediately. On other hosts we'd chase the release cycle — occasionally hitting weeks of lag on ISR, partial pre-rendering, or middleware changes.

**Cost visibility.** Flat $20/seat + metered overage is easy to forecast. No surprise AWS bills from misconfigured autoscalers or data-transfer quirks.

**Escape hatch is real, not theoretical.** Because we're disciplined about avoiding Vercel-only primitives, migration to Fargate/ACA/OpenNext is a 1–2 day move — Dockerfile exists, state lives elsewhere, code is unchanged.

## Consequences

**Positive**
- First production deploy in under an hour.
- Free preview URLs per PR.
- Bundled analytics, logs, and speed insights.
- Low cognitive overhead — infra is someone else's problem until it isn't.

**Negative**
- $20/seat/month baseline even at zero traffic.
- Bandwidth overage at $0.40/GB gets expensive past ~1 TB/month (roughly 10× CloudFront pricing).
- 300s function timeout ceiling — enforces that long-running work (scraping, large PDF jobs) lives in the dedicated scraper service. Already planned, just worth stating.
- Medium vendor coupling — mitigated by the Dockerfile + forbidden-primitives rule above.

## Revisit triggers

Re-evaluate hosting if any of the following hit:
- Sustained bandwidth bill > $200/month.
- Enterprise deal requires VPC peering, data residency, or a BAA.
- Vercel function limits block a product feature we need in-band.
- Team grows past 3 developers and per-seat pricing begins to dominate.

## Alternatives considered

- **AWS ECS Fargate + ALB + CloudFront/S3 for assets** — Cheapest at scale, most familiar to the team. Rejected for MVP because 1–3 days of setup and ongoing ops tax outweighs the ~$50/month savings. Kept as the primary migration target.
- **Azure Container Apps (scale-to-zero)** — Cheapest at low traffic and attractive for burst workloads. Rejected because it still carries Terraform + monitoring + CI overhead that Vercel absorbs entirely.
- **OpenNext on AWS (S3 + Lambda + CloudFront)** — Good long-term AWS-native path. Rejected for MVP because SST/OpenNext configuration plus framework-version alignment is ongoing work. Strong revisit option once cost or compliance forces an AWS move.
- **Self-host on Fly.io / Railway** — Friendly middle ground. Rejected because it still requires more ops than Vercel without giving us the cost or control advantages of raw AWS.
