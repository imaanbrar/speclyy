# ADR-0009: Object storage — Supabase Storage

- **Status:** Accepted
- **Date:** 2026-04-20

## Context

Speclyy stores three categories of assets:

| Asset | Size estimate | Access pattern |
|---|---|---|
| Product images (scraped or uploaded) | 50–500KB each | Public read, write-once |
| Exported PDFs | 100KB–5MB | Private, short-lived download URL |
| User profile photos | < 1MB | Public read (post-MVP) |

At 10,000 designers the estimated footprint is ~215GB storage and ~3,600GB egress/month, based on 5 projects × 30 items × 150KB average image per designer, 15 sessions/month, 40 images/session, 60% cache hit rate. Storage costs are nearly identical across providers. Egress cost is the dominant differentiator at scale.

Three options were evaluated:
- **Supabase Storage** — S3-compatible, bundled with the Supabase project, RLS-aware, includes image transformations.
- **Cloudflare R2** — S3-compatible, zero egress fees, Cloudflare CDN, no bundled transforms.
- **AWS S3 + CloudFront** — mature, familiar, egress-charged, ops overhead.

## Decision

Use **Supabase Storage** for MVP.

Migrate to **Cloudflare R2** when the Supabase Storage overage bill exceeds **$50/month** (approximately 750GB egress/month over the 250GB included in Pro — roughly 1,500–2,000 active designers).

## Rationale

**Bundled, zero additional setup.** Supabase Storage ships with the existing Supabase project. No new vendor, no new billing, no new credentials, no CORS configuration. Time-to-first-upload is minutes.

**RLS on buckets.** Bucket policies use the same `auth.uid()` pattern as database policies — a user cannot read another designer's uploaded images. The integration is native rather than bolted on.

**Image transformations included.** The `?width=400&quality=80` transform URL is built-in. Product thumbnails and resized previews require no Sharp pipeline, no Lambda, and no Cloudflare Images add-on.

**Migration path is clean and low-risk.** Both Supabase Storage and R2 are S3-compatible. Migration is: create R2 bucket, copy objects, swap the storage client config, update image URL base. No application logic changes. The migration trigger ($50/month overage) gives a clear, measurable signal with no ambiguity.

**Cost is $0 overage at MVP scale.** At under ~1,000 active designers, egress stays within the 250GB included in Supabase Pro. The per-GB overage rate ($0.09/GB) only becomes meaningful at scale.

### Cost model at key scales

| Scale | Supabase Storage | Cloudflare R2 | Monthly delta |
|---|---|---|---|
| 500 designers | ~$0 (within Pro) | ~$1 | negligible |
| 1,000 designers | ~$30 overage | ~$5 | $25 |
| 2,000 designers | ~$72 overage | ~$10 | $62 |
| 10,000 designers | ~$304 overage | ~$40 | $264 |

Egress is the entire difference — R2 charges $0/GB out, Supabase charges $0.09/GB after 250GB included.

## Consequences

**Positive**
- Zero new vendor, zero new ops, zero new billing at launch.
- RLS on files matches the database isolation model — consistent security pattern.
- Built-in image transforms remove the need for a separate image processing pipeline.
- S3-compatible from day one — migration to R2 is a config swap, not a code rewrite.

**Negative**
- Egress pricing ($0.09/GB) becomes expensive at scale — R2 is ~7.5× cheaper at 10,000 designers.
- Supabase CDN is less globally distributed than Cloudflare's network. Acceptable at MVP; a reason to prefer R2 at scale.
- 5MB default file size limit per upload (configurable to 50MB on Pro). Sufficient for product images.

## Migration trigger

**Migrate to Cloudflare R2 when Supabase Storage overage exceeds $50/month.**

At the modelled egress profile, this occurs around 1,500–2,000 active designers.

Migration steps when triggered:
1. Create R2 bucket and configure public domain or Cloudflare CDN URL.
2. Copy existing objects using `rclone` or an R2-compatible S3 sync tool.
3. Swap the storage client from `supabase.storage` to AWS S3 SDK / `@aws-sdk/client-s3` pointing at R2 endpoint.
4. Update the image URL base in the application config.
5. Validate CDN URLs serve correctly. Decommission Supabase bucket.

No application logic changes required — the storage client is the only thing that changes.

## Alternatives considered

- **Cloudflare R2** — Zero egress fees, excellent CDN, $0.015/GB storage. Rejected for MVP because: adds a new vendor and billing relationship; requires separate image transform solution (Cloudflare Images add-on, ~$5/million transforms); no RLS integration; setup takes 30–60 minutes vs zero for Supabase. Named as the migration target when egress overage hits $50/month.
- **AWS S3 + CloudFront** — Mature, familiar to the team, best-in-class CDN. Rejected because: adds ops overhead (IAM, bucket policies, CloudFront distribution, CORS config) inconsistent with our decision to minimise infra burden at MVP; egress costs ($0.085/GB) are similar to Supabase overage pricing without any bundled benefit; another vendor on top of already-chosen Supabase and Vercel.

## References

- ADR-0004 Postgres host — Supabase (same project, same billing)
- ADR-0005 Auth provider — Supabase Auth (RLS pattern)
