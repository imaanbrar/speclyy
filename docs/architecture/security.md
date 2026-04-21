# Security & Privacy

> **Status:** stub — outline only.

Platform-wide security posture: threat model, secrets, trust boundaries, data handling.

## Scope

Not a replacement for auth.md (which covers sign-in mechanics). This doc is the cross-cutting view: what we protect, from whom, how.

## Outline

### 1. Threat model
- Assets: user PII, auth sessions, Stripe customer IDs, scraped content, admin credentials
- Adversaries: opportunistic web attackers, scraped vendors (rate-limit / block), malicious users, insider mistakes
- Out of scope: nation-state, physical

### 2. Trust boundaries
- Browser ↔ Next.js
- Next.js (anon) ↔ Supabase (RLS-enforced)
- Next.js (service role) ↔ Supabase (bypasses RLS — limited routes)
- Next.js ↔ Fly scraper
- Stripe ↔ Next.js webhooks
- Admin surfaces ↔ everything

### 3. Secrets management
- Where secrets live (Vercel env, Fly secrets, Supabase dashboard)
- Rotation policy
- Local `.env` hygiene
- No secrets in client bundles — audit story

### 4. Service-role key handling
- Which routes legitimately need it
- How we prevent accidental import into client / RLS-safe paths
- Lint / review guardrails

### 5. Admin API protection
- Auth mechanism (shared secret? JWT? allowlist?)
- Rate limiting
- Audit logging

### 6. File upload validation
- MIME sniffing, size caps, extension allowlist
- Storage bucket policies
- Image re-hosting path from scraper

### 7. Rate limiting & abuse
- Per-user / per-IP limits on expensive endpoints (scrape, auth)
- Bot / scraping of Speclyy itself

### 8. RLS policy discipline
- Cross-ref [database.md](database.md)
- Test strategy: policy unit tests

### 9. Data retention & deletion
- Account deletion flow (soft vs hard)
- Stripe customer handling on deletion
- Scraped cache retention
- Log retention in Axiom

### 10. Audit logging
- What we log, where, retention
- PII in logs (forbidden list)

### 11. Incident response
- See [operations.md](operations.md) — runbooks live there

## Cross-references
- [auth.md](auth.md)
- [database.md](database.md) — RLS
- [billing.md](billing.md) — Stripe webhook verification
- [operations.md](operations.md)
