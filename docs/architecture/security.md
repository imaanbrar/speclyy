# Security & Privacy

Platform-wide security posture: threat model, secrets management, trust boundaries, RLS discipline, data handling, and incident response. Auth mechanics (sign-in flow, session cookies) are in [auth.md](auth.md) — this doc covers the cross-cutting concerns.

---

## Threat model

### Assets

| Asset | Sensitivity | Location |
|---|---|---|
| User PII (name, email, studio) | High | `public.profiles`, Supabase Auth |
| Auth session tokens | Critical | httpOnly cookies, Supabase Auth |
| Stripe customer + payment data | Critical | Stripe (never stored locally beyond IDs) |
| Scraped product content | Low | `public.scrape_cache`, Supabase Storage |
| Service-role key | Critical | Vercel env, Fly secrets |
| Admin shared secret | Critical | Vercel env |
| Anthropic API key | High | Fly secrets |

### Adversaries and scenarios

| Adversary | Scenario | Primary control |
|---|---|---|
| Unauthenticated web attacker | Access another user's data | RLS on all tables; JWT required |
| Authenticated user | Read/modify another user's data | RLS policies enforce `auth.uid()` scoping |
| Vendor sites | Block / rate-limit Speclyy scraper | Stealth headers, retry logic, failure taxonomy |
| Stripe webhook forger | Inject fake billing events | `stripe.webhooks.constructEvent` signature check |
| Malicious file upload | Store dangerous content | MIME validation, size cap, bucket policy |
| Insider mistake | Accidentally expose service-role key | Env var scoping, lint rules, no client bundle |

Out of scope: nation-state attacks, physical access, supply-chain compromise of npm packages.

---

## Trust boundaries

```
┌──────────────────────────────────────────────────────┐
│  Browser (untrusted)                                  │
│  - Only ever receives: anon key, public CDN URLs      │
│  - No access to service-role key, admin secret,       │
│    Stripe secret, Anthropic key                       │
│  - JWT is in httpOnly cookie — not readable by JS     │
└───────────────────────┬──────────────────────────────┘
                        │ HTTPS + httpOnly cookie
┌───────────────────────▼──────────────────────────────┐
│  Vercel / Next.js (semi-trusted server)               │
│  - Verifies Supabase JWT on every request (middleware)│
│  - Service-role key used only in:                     │
│      /api/webhooks/stripe (Stripe webhook handler)    │
│      /api/webhooks/inngest (Inngest callback)         │
│      /api/scraper/callback                            │
│      /api/admin/* (admin APIs)                        │
│  - Stripe sig verified before any DB write            │
│  - Admin shared secret verified before any admin op  │
└─────────┬──────────────────────────┬─────────────────┘
          │ service-role             │ Inngest trigger
┌─────────▼──────────┐   ┌──────────▼──────────────────┐
│  Supabase (trusted) │   │  Fly.io Scraper (trusted)   │
│  RLS bypassed for   │   │  service-role key for DB     │
│  service-role calls │   │  no user JWT context         │
│  RLS enforced for   │   │  Anthropic key for Claude    │
│  anon/JWT calls     │   │  outbound-only to vendors    │
└─────────────────────┘   └─────────────────────────────┘
```

---

## Secrets management

### Where secrets live

| Secret | Dev | Production |
|---|---|---|
| `SUPABASE_SECRET_KEY` | `.env.local` | Vercel env (server-only) |
| `STRIPE_SECRET_KEY` | `.env.local` | Vercel env (server-only) |
| `STRIPE_WEBHOOK_SECRET` | `.env.local` | Vercel env (server-only) |
| `INNGEST_SIGNING_KEY` | `.env.local` | Vercel env (server-only) |
| `ADMIN_SECRET` | `.env.local` | Vercel env (server-only) |
| `ANTHROPIC_API_KEY` | Fly secret | Fly secret |

`NEXT_PUBLIC_*` variables are intentionally public — only anon key and Supabase URL.

### Rules

- `.env.local` is in `.gitignore`. Never commit secrets.
- Vercel env vars marked **Server-only** are not exposed to the browser bundle.
- Fly secrets are encrypted at rest and only exposed as env vars inside the container.
- Rotation: rotate compromised secrets immediately via Vercel/Fly dashboard + Stripe/Supabase dashboard. No automated rotation yet.

### No secrets in client bundles

Any import of `SUPABASE_SECRET_KEY` or `STRIPE_SECRET_KEY` in a file that could be included in the browser bundle (client components, `use client` files) is a critical bug. Enforcement:

- ESLint rule (planned): flag `process.env.SUPABASE_SECRET_KEY` in client component files.
- Manual review gate on PRs touching auth or billing.

---

## Service-role key handling

The service-role key bypasses Postgres RLS entirely. It must only be used where RLS is intentionally not applicable:

| Route / context | Reason |
|---|---|
| `POST /api/webhooks/stripe` | Stripe writes to `subscriptions` without a user JWT |
| `POST /api/webhooks/inngest` | Inngest callbacks write scrape results without a user JWT |
| `POST /api/scraper/callback` | Scraper reports results to Next.js |
| `POST /api/admin/*` | Admin operations across users |

All other routes use the anon key with JWT — RLS is enforced automatically.

If a Drizzle client is ever wired up against the project's direct Postgres connection (currently not in use — see [ADR-0021](adr/0021-single-supabase-project.md)), it must only be instantiated in Route Handler files, never in RSC or Server Action files where the Supabase JWT client is correct.

---

## Admin API protection

Admin APIs (`/api/admin/*`) are protected by a shared secret passed in the `Authorization` header:

```ts
const secret = req.headers.get('authorization')?.replace('Bearer ', '')
if (secret !== process.env.ADMIN_SECRET) {
  return new Response('Forbidden', { status: 403 })
}
```

All admin requests are logged to Axiom with the endpoint, payload shape, and timestamp. No PII in logs.

Admin APIs are intended for internal use only (Speclyy team tooling, scripts). They are not part of any public API surface.

---

## Row-Level Security discipline

All `public.*` tables have RLS enabled. Baseline pattern:

```sql
-- User can only read/write their own rows
CREATE POLICY "table: self read" ON public.table
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "table: self write" ON public.table
  FOR INSERT WITH CHECK (owner_id = auth.uid());
```

`scrape_cache` and `global_products` are readable by all authenticated users (shared data). `subscriptions` has no user-facing write policy — only the service-role key (Stripe webhook) may write.

**Testing:** Each RLS policy must have a corresponding test that:
1. Asserts a user can read their own row.
2. Asserts the same user cannot read another user's row.
3. Asserts unauthenticated access returns nothing.

---

## File upload validation

Uploads to Supabase Storage are gated by:

| Control | Detail |
|---|---|
| **Bucket policy** | `product-images`: authenticated write only; `pdf-exports`: owner write only |
| **MIME type** | Accepted: `image/jpeg`, `image/png`, `image/webp`. Rejected at upload. |
| **File size cap** | 10 MB per image upload |
| **Extension allowlist** | `.jpg`, `.jpeg`, `.png`, `.webp` |

Scraper image uploads use the service-role key but validate content-type from the vendor response before re-hosting.

---

## Rate limiting & abuse

| Surface | Current control | Planned |
|---|---|---|
| `/sign-in` (OAuth) | Supabase Auth rate limiting (built-in) | — |
| Add-item / scrape trigger | Per-user: 50 scrapes/day (Inngest job gate) | Stricter per-plan limits |
| Admin APIs | IP allowlist via Vercel firewall (planned) | — |
| Vercel edge | Vercel's built-in DDoS protection | — |

No custom rate limiting middleware yet outside Supabase Auth and the scrape daily cap.

---

## Data retention & deletion

### Account deletion

1. User requests deletion from account settings.
2. Server Action calls `supabase.auth.admin.deleteUser(userId)` (service-role).
3. Cascade deletes via FK: `auth.users` → `profiles` → `projects` → `project_groups` → `project_items`.
4. Stripe customer: `stripe.customers.del(stripeCustomerId)` — removes payment methods and cancels subscriptions.
5. Storage: objects in `pdf-exports` and `profile-photos` belonging to the user are deleted. `product-images` objects are shared (scrape cache) — not deleted.

### Scraped content

`scrape_cache` rows default to a 90-day TTL (ADR-0012; known-stable domains extend to 1 year, volatile domains tighten to 14 days — see `scraper/config/domains.ts`). If a vendor requests takedown, rows are manually deleted and the re-hosted image is removed from Storage ahead of the TTL.

The full compliance policy — User-Agent identification, robots.txt handling (bulk: honoured; on-demand: user-directed, not checked), vendor ToS denylist, takedown SLA (72h) — lives in [scraper/compliance.md](scraper/compliance.md). That doc is the single source of truth for any legal or vendor-facing question about the scraper.

### Log retention

- Axiom: 30-day default retention. Extended to 90 days for scraper failure logs.
- Vercel function logs: 1 day (Vercel default).

### PII in logs

Forbidden in logs: email, name, `stripe_customer_id`. Allowed: `user_id` (UUID), `scrape_cache_id`, error types, URL hashes.

---

## Audit logging

Currently limited to Axiom structured logs on:

- Admin API calls (endpoint, timestamp, success/fail — no payload PII)
- Stripe webhook events received and processed (event type, event id, outcome)
- Subscription state changes (user_id, old status, new status)

Full audit trail (who accessed what data, when) is not yet implemented. Planned before any enterprise/team tier.

---

## Incident response

See [operations.md](operations.md) for runbooks covering:
- Supabase Auth outage
- Service-role key compromise
- Stripe webhook backlog
- Data breach triage

---

## References

- [auth.md](auth.md) — sign-in, session cookies, RLS policies
- [database.md](database.md) — RLS policy definitions
- [billing.md](billing.md) — Stripe webhook signature verification
- [operations.md](operations.md) — alerting, runbooks, incident response
- [deployments.md](deployments.md) — secrets injection per environment
