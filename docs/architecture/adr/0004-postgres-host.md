# ADR-0004: Postgres host — Supabase

- **Status:** Accepted
- **Date:** 2026-04-20

## Context

ADR-0003 commits us to Postgres. We need a managed Postgres host. Realistic candidates:

- **Supabase** — managed Postgres bundled with auth, storage, RLS integration, and DB branching
- **Neon** — serverless Postgres with scale-to-zero, copy-on-write branching, no bundled auth/storage
- **AWS RDS for PostgreSQL** — mature managed Postgres, author has production experience
- **Azure Database for PostgreSQL (Flexible Server)** — author has production experience
- **Aurora Serverless v2** — AWS autoscaling Postgres-compatible DB

All five provide a Postgres target we can connect to. The differences are:
- What's bundled beyond the DB (auth, storage, dashboard)
- Ops burden and setup time
- Pricing at MVP scale
- Coupling / lock-in risk

Speclyy's constraints (solo dev, speed-to-MVP, time is the scarce resource) push us toward bundled platforms over assembled infrastructure.

### Pricing at MVP scale (early 2026)

| Host | All-in monthly (DB + auth + storage) |
|---|---|
| Supabase Pro | $25 |
| Neon Launch + Clerk + R2 | ~$45+ |
| AWS RDS (t4g.micro) + Cognito + S3 | ~$30 + ops hours |
| Azure Flex PG (B1ms) + Azure AD B2C + Blob | ~$30 + ops hours |
| Aurora Serverless v2 (0.5 ACU min) | ~$44 (DB alone) + auth/storage |

## Decision

Use **Supabase (Pro plan, $25/mo)** as the Postgres host.

Use Supabase's bundled services where they fit natively:
- **Auth** — Google OAuth via Supabase Auth (GoTrue). Covered in a later ADR.
- **Storage** — Supabase Storage for product images and user uploads. Covered in a later ADR.
- **RLS** — Postgres Row-Level Security policies using `auth.uid()` for tenant isolation.
- **Database branching** — per-Git-branch preview databases for PR environments.

## Rationale

**Bundled wins at MVP stage.** Supabase ships Postgres + auth + storage + RLS integration in one product. Picking the "assembled" alternative (Neon + Clerk + R2) means three vendors, three dashboards, three billing relationships, and integration glue to sync auth user IDs into the database. Same outcome, more work.

**RLS integration is tight and meaningful.** `CREATE POLICY ... USING (user_id = auth.uid())` gives us tenant isolation at the database layer — not just in application code. With Neon + Clerk, we'd pass JWT claims through and rely on application-layer checks. Supabase's coupling of auth and DB turns a security-sensitive cross-cutting concern into a one-line policy.

**Cost arithmetic favors Supabase.** At MVP scale, Supabase Pro ($25/mo) is cheaper than Neon Launch ($19) + Clerk Pro ($25) + R2 (~$1) combined. It also absorbs the DB-branching line item that Neon charges for.

**DB branching for preview environments.** Vercel preview deploys per PR pair naturally with Supabase branch databases. Each PR gets its own isolated schema + data for testing.

**Database is real Postgres.** Extensions work — `pgvector`, `pg_trgm`, `citext`, `postgis`. We are not locked into a Postgres-fork or wire-compatible reimplementation. `pg_dump` exports cleanly.

**Time-to-first-query is 10 minutes.** No VPC, no security groups, no subnet math, no Terraform module to maintain, no PITR-to-S3 script to keep current.

**Dashboard usable by non-devs.** Future collaborator or design partner can inspect data through the Supabase table editor without needing a DB client or SQL comfort.

## Consequences

**Positive**
- Single vendor, single bill, one integration surface for DB + auth + storage.
- RLS-as-tenant-isolation is a first-class pattern, not a bolt-on.
- DB branching per PR is included in the Pro plan.
- Zero infra ops — no backup scripts, connection-pooler maintenance, or VPC plumbing.
- Real Postgres — portable via `pg_dump` if we need to exit.

**Negative**
- **Auth coupling.** Heavy RLS use ties us to GoTrue as the auth provider. Swapping auth later (e.g. to Clerk) means rewriting policies — roughly a week of work. Acceptable at MVP stage; worth flagging for future.
- **Storage performance is good, not S3-class.** Hot-path asset delivery may need CDN fronting or a later move to R2/S3. Not an MVP problem.
- **Connection limits on small compute.** Requires Supavisor pooler for serverless Next.js workloads — mandatory, not optional, but Supabase handles it.
- **Vendor younger than RDS/Azure.** Company-continuity risk is non-zero but mitigated by Postgres portability.

## Revisit triggers

Re-evaluate hosting if any of these hit:
- DB size > 50 GB sustained, or query latency p95 > 200ms on Pro-tier compute after tuning.
- Enterprise deal requires VPC peering, dedicated instance, or data residency beyond Supabase's regions.
- Supabase auth becomes a blocker (need SSO/SAML that isn't on the Pro tier, or need to share auth with another product on Clerk/Auth0).
- Team grows and we want to decouple DB/auth/storage for independent vendor choice.

## Alternatives considered

- **Neon** — Better pure-Postgres experience, best-in-class copy-on-write branching, scale-to-zero for preview envs. Rejected because it forces us to assemble auth (Clerk / NextAuth) and storage (R2 / S3) separately — more vendors, more integration work, higher all-in cost at MVP scale. Strong revisit candidate if we later decouple.
- **AWS RDS for PostgreSQL** — Mature, familiar to the author, cheapest DB-only option. Rejected because setup (VPC, security groups, RDS Proxy for serverless, backups, monitoring, migrations pipeline) is 20–40 hours and then never stops. We'd still need to pick auth and storage. Kept as migration target if we go all-in on AWS.
- **Azure Database for PostgreSQL (Flexible Server)** — Familiar to the author. Rejected for the same reason as RDS, with no compensating advantage unless we're committing to Azure infrastructure.
- **Aurora Serverless v2** — Postgres-compatible, autoscaling. Rejected because it's not *native* Postgres (extension gaps), minimum cost is higher ($44/mo for 0.5 ACU), and we still need to pick auth/storage.
- **Render / Railway Postgres** — Cheap ($7–10/mo) managed Postgres. Rejected on missing features (no RLS-aware auth integration, no branching, minimal PITR, smaller ecosystem) — fine for side projects, not for a commercial product.
- **PlanetScale Postgres** — Launched late 2024. Rejected as too new to bet MVP on; revisit in 12–18 months.
