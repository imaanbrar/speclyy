# Speclyy — Product & Engineering Roadmap

Captures every future item discussed during architecture and planning. Items are grouped by phase and category. Infrastructure triggers are event-driven — they don't belong to a sprint, they happen when a condition is met.

> **Status key:** 🔲 Not started · 🔜 Next up · ✅ Done / in MVP

---

## MVP (in scope, building now)

Listed here as context — these are not roadmap items, they're the baseline.

- ✅ Auth — Google OAuth, onboarding flow, trial + billing gate
- ✅ Projects, groups, product items (CRUD)
- ✅ URL paste → scrape → prefill (async, Supabase Realtime update)
- ✅ Manual product entry (always available as fallback)
- ✅ Basic PDF export
- ✅ Stripe trial + subscription billing
- ✅ Global product library (seeded, promoted from scrapes)
- ✅ Bulk crawl pipeline (admin-triggered, Inngest cron + fan-out)
- ✅ Scraper browser pool (pre-warmed pages — P0, ships with MVP)
- ✅ Inline failure UX (item stays in place, partial data shown, retry button — P0)
- ✅ Marketing site — `speclyy.com` (Astro)
- ✅ Monorepo (`apps/marketing` + `apps/web`)

---

## MVP+1 — First sprint after launch

The highest-priority items the moment the product is live with real designers.

### Product

| Item | Context |
|---|---|
| 🔜 **My Library** — save products across projects | Designer finds a product they love → save to personal library → reuse on any future project without re-pasting the URL. Was Decision 6 in MVP scope but cut. Immediately post-MVP. |
| 🔜 **PDF — studio branding** | Designer's own logo and studio name on exported spec sheets. Currently exports with Speclyy branding only. Post-MVP. |
| 🔜 **CSV export** | Export a project's product list as CSV. Simple, high-value for designers who also use Excel/Sheets. |
| 🔜 **Live shareable spec sheet link** | Share a public URL with clients instead of static PDF. Client sees real-time updates when designer changes specs. |

### Scraper

| Item | Context |
|---|---|
| 🔜 **Activity-triggered pre-warm** | When a designer opens a project, ping Fly.io `/internal/warm` to top up the browser pool to 4 pages. Near-zero cold start for active sessions. P1 — before 10 designers onboarded. |
| 🔜 **Bulk crawl priority queue** | Axiom query shows which domains designers paste most → bulk crawl those first. Cache flywheel grows faster. |
| 🔜 **Claude Opus → Sonnet A/B test** | After 500 live scrapes, A/B test 20% of traffic on `claude-sonnet-4-6`. If completeness quality delta < 5%, downgrade permanently. Saves ~40% on Claude API cost. |

### Admin

| Item | Context |
|---|---|
| 🔜 **Global product library approval UI** | Internal screen to review `promotion_queue` items (products scraped from whitelisted domains, pending review). Currently there's no UI — approve via service-role Drizzle directly. Simple table + approve/reject buttons. |

---

## v2 — Second major iteration

Significant new capabilities. Don't plan implementation details until MVP is live and validated.

### Moodboards

| Item | Context |
|---|---|
| 🔲 **Structured grid moodboard** | Products in a project dragged into a visual grid. dnd-kit for reordering, Framer Motion `layout` for animated shuffle. Export as image. The practical 80% of moodboard value with ~2 weeks of effort. |
| 🔲 **Freeform canvas moodboard** | Items freely positioned on a canvas — drag anywhere, resize, overlap, annotate. Framer Motion drag + `useMotionValue` for freeform positioning (up to ~30 items). Migrate to tldraw for full canvas complexity. |
| 🔲 **Auto-generated moodboard layout** | Given the products in a project group, algorithmically arrange them into a visually balanced grid based on image aspect ratios and product count. No AI needed for v1 — layout algorithm. |

### Product

| Item | Context |
|---|---|
| 🔲 **Collaboration + permissions** | Multiple designers or designer + assistant on one project. Role-based (owner, editor, viewer). Requires org/team data model. Supabase RLS already set up for this extension. |
| 🔲 **Live pricing + availability** | Scraper checks whether a product is in stock and its current price. Requires periodic re-scrape of saved items. Complex — vendor sites vary wildly. |
| 🔲 **Pinterest import** | Import a Pinterest board → extract product URLs → run through scraper → generate draft spec items. Requires Pinterest API or scrape of public boards. |

### Scraper

| Item | Context |
|---|---|
| 🔲 **Popular URL refresh cron** | Weekly cron: find URLs pasted by ≥ 3 distinct designers in last 30 days where `scrape_cache.created_at` > 7 days ago → re-scrape to keep popular products fresh. Requires lightweight `scrape_requests_log` table. |
| 🔲 **Progressive field streaming** | Stream Claude's JSON output via SSE and populate fields as tokens arrive — brand + name appear at 4s, not 12s. Requires Claude streaming API + client-side partial JSON parser. Option B (client-side field animation stagger) ships at MVP as the simpler version. |
| 🔲 **Residential proxy rotation** | For domains consistently failing with `error_type = 'anti_bot'` (> 20% failure rate): route through residential proxy pool. Add when blocked-domain list accumulates to a meaningful size. |

---

## v3+ — Longer-term vision

From `docs/vision.md`. Don't plan these yet — validate the earlier phases first.

| Item | Context |
|---|---|
| 🔲 **AI moodboard generation** | Claude analyses the products in a project — finishes, materials, aesthetic — and generates a cohesive moodboard with layout narrative. Combine with colour extraction from product images. |
| 🔲 **Draft spec sheets from inspiration** | Designer uploads an inspiration image (room photo, magazine tear) → Claude identifies products, suggests matches from the global library → designer approves/replaces. AI-assisted, human-approved. |
| 🔲 **Multi-source ingestion** | Ingest product data beyond URLs: PDF vendor tear sheets (upload → parse), vendor quote spreadsheets (CSV/Excel → extract), email attachments. |
| 🔲 **Canva export** | Export a spec sheet or moodboard as a Canva-compatible format for client-ready presentation packs. Requires Canva API integration. |
| 🔲 **Procurement + ordering** | Generate purchase orders, track order status, connect to vendor portals. Major scope increase — different product surface. |
| 🔲 **Community / marketplace** | Designers share spec sheet templates, room packages, curated product collections. Requires moderation, reputation, trust layer. |
| 🔲 **Markets expansion** | `profiles.market` currently supports `los_angeles`, `new_york`, `dallas`, `calgary`. Expand market coverage with local supplier data. |

---

## Infrastructure triggers

These are not sprint items — they activate when a condition is met. Review quarterly.

| Trigger condition | Action | Current status |
|---|---|---|
| Supabase Storage overage > **$50/month** (~1,500–2,000 designers) | Migrate `product-images` and `pdf-exports` buckets to Cloudflare R2. See [ADR-0009](architecture/adr/0009-storage.md) for migration steps. | Not triggered |
| Claude API cost > **$400/month** | Run Sonnet A/B test. If quality holds, switch permanently. Also evaluate Batch API for bulk crawl. | Not triggered |
| Inngest executions consistently > **45,000/month** (~3,000 active designers) | Upgrade to Inngest Pro ($75/month). | Not triggered |
| Supabase DB > **50 GB** or p95 query latency > **200ms** | Upgrade compute tier or evaluate migration to dedicated Postgres. See [ADR-0004](architecture/adr/0004-postgres-host.md). | Not triggered |
| Any scrape domain failure rate crosses **30%** | Add domain to monitored list. Diagnose error type. Fix via domain config or proxy rotation. | Ongoing |
| Vercel forbidden primitives needed, or team > 3 devs | Evaluate migration to ECS or Azure Container Apps. See [ADR-0002](architecture/adr/0002-hosting-platform.md) migration steps. | Not triggered |
| Shared UI package extracted or build times slow | Add Turborepo to monorepo for build caching. | Not triggered |
| Axiom ingest > 400 GB/month | Upgrade to Axiom paid plan. | Not triggered (using ~5 MB/month) |

---

## Engineering improvements

Continuous improvements — pick up when the relevant feature is being worked.

### Database
| Item | Context |
|---|---|
| 🔲 **`crawl_urls` archival cron** | Table grows at 1,200+ rows per brand crawl. After 6 months of bulk crawls: archive completed crawl rows to cold storage or delete. Post-MVP maintenance. |
| 🔲 **`promo_codes` table** | `subscriptions.promo_code_id` FK is a placeholder. Model the `promo_codes` table when promotions/referrals are needed. |
| 🔲 **Custom JWT claims** | Promote `is_onboarded` and subscription `status` into JWT as custom claims. Removes the DB read in every middleware execution. Defer until middleware latency is measurable. |
| 🔲 **Semantic search (pgvector)** | Enable `pgvector` extension for AI moodboard matching, "find similar products", designer analytics. Pre-req for v3 AI features. |
| 🔲 **Subscription history table** | Audit trail of subscription status changes. Currently the `subscriptions` table is overwritten. Add an `subscription_events` log table when needed for support tooling. |

### Scraper
| Item | Context |
|---|---|
| 🔲 **`scrape_requests_log` table** | Lightweight log of every on-demand scrape request (url_hash, user_id, timestamp). Required for popular URL refresh cron. |
| 🔲 **`fields_extracted_count` integer in Axiom log** | APL can't `mv-expand` string arrays. Log `fields_extracted_count: number` alongside `fields_extracted: string[]` so Axiom queries can aggregate on it. |
| 🔲 **HTML pruning improvements** | Better DOM selector logic (`main`, `[data-product]`, `.product-details` priority) reduces token count by 10–20%, lowering Claude API cost. |

### Admin
| Item | Context |
|---|---|
| 🔲 **Proper admin dashboard** | Replace Axiom as the admin interface. Next.js `/admin` route group with Axiom API embedded for analytics, crawl management UI, failure inspection. Ship when team grows or Axiom dashboard becomes limiting. |
| 🔲 **Multi-person admin API** | Current `ADMIN_API_KEY` is a single shared secret. Suitable for 1–2 people. Needs rotation + per-person keys as team grows. |

---

## Marketing site — pending items

| Item | Context |
|---|---|
| 🔲 **Real product screenshots** | Hero and How It Works sections have placeholder images. Replace with actual UI screenshots when the app is built. |
| 🔲 **OG images** | `/public/og-default.png` placeholder. Generate real branded OG images for social sharing. |
| 🔲 **Privacy policy + Terms pages** | `pages/privacy.astro` and `pages/terms.astro` exist as stubs. Write actual content before launch. |
| 🔲 **`@astrojs/sitemap`** | Add sitemap generation when content pages are added. One integration, one config line. |
| 🔲 **Pricing toggle** | `PricingToggle.tsx` island for interactive monthly/annual switch on the Pro plan card. Current card displays the annual price with a static note for monthly. |
| 🔲 **Testimonials section** | Add a social proof section with real designer quotes once early users are onboarded. |
| 🔲 **Self-hosted fonts** | Currently loading Inter from Google Fonts. Self-host in `public/fonts/` for GDPR compliance and faster load (no Google DNS lookup). |

---

## References

- [architecture/adr/](architecture/adr/) — decision records for all locked choices
- [mvp-prd.md](mvp-prd.md) — full MVP scope and out-of-scope list
- [vision.md](vision.md) — long-term product vision
- [architecture/scraper/performance.md](architecture/scraper/performance.md) — scraper improvement priorities
- [architecture/scraper/failure-tracking.md](architecture/scraper/failure-tracking.md) — failure feedback loop
- [architecture/estimated-infra-costs.md](architecture/estimated-infra-costs.md) — infrastructure upgrade triggers
