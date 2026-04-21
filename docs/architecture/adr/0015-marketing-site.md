# ADR-0015: Marketing site — Astro in monorepo, deployed on Vercel

- **Status:** Accepted
- **Date:** 2026-04-20

## Context

Speclyy needs a marketing site (`speclyy.com`) separate from the product app (`app.speclyy.com`). Requirements:

- Rich animations and high-quality images (hero section, product demos)
- Lighthouse 95+ performance score — SEO and conversion depend on it
- Fast to update — copy and layout changes should not require touching app code
- Hosted on same platform as the app where possible (single dashboard, single Git integration)
- Minimal operational overhead for a solo developer

## Decision

**Framework:** Astro (static output)
**Deployment:** Vercel — second project on the existing Pro account, same dashboard
**Repository:** Monorepo — `apps/marketing/` alongside `apps/web/` under pnpm workspaces
**Interactive components:** React Islands via `@astrojs/react` (Framer Motion inside islands)
**Scroll animations:** GSAP ScrollTrigger (loaded only on pages that use it)
**Images:** Astro's built-in `<Image />` component (Sharp, WebP, responsive `srcset`)

## Rationale

### Astro over Next.js for marketing

The `(marketing)` route group was planned inside the Next.js app but separating it is the right call:

**Zero JS by default.** Astro sends zero JavaScript unless a component is explicitly marked as interactive (`client:visible`, `client:load`). A landing page that's 95% static HTML + CSS ships ~5KB JS (the React Island) vs Next.js's ~90KB runtime on every page.

**Islands architecture.** The URL demo widget and pricing toggle are the only interactive elements on the marketing site. These are React Islands — everything else is pure Astro with no hydration cost.

**Built-in image pipeline.** `<Image />` handles Sharp compression, WebP conversion, and responsive `srcset` without any configuration. Critical for a page with product screenshots and hero imagery.

**Independent deploy cadence.** Marketing copy, layout, and assets change independently of app code. Separating them means a hero copy tweak doesn't trigger an app build.

### Vercel over Cloudflare Pages

Already paying for Vercel Pro. Pro covers multiple projects under the same account — no additional cost. Astro has an official `@astrojs/vercel` adapter. Same Git integration, same dashboard, same deploy previews. No reason to introduce a second platform.

### Monorepo over separate repo

```
speclyy/
├── apps/
│   ├── marketing/    ← Astro
│   └── web/          ← Next.js
├── pnpm-workspace.yaml
└── package.json
```

Single repo is simpler for a solo developer: one place for docs, one PR touches both if a shared design token changes, one clone. Vercel handles monorepo builds natively — set "Root Directory" per project, it deploys only the affected app on push.

**Turborepo:** not added at this stage. No shared code between apps yet. Add when build caching becomes valuable (likely when the UI package is extracted).

### pnpm workspaces over npm/yarn

Consistent with tooling direction. Efficient hoisting, workspace protocol (`workspace:*`) for future shared packages.

## Consequences

**Positive**
- Marketing site Lighthouse scores: 95–100 achievable with Astro static output
- No JS runtime overhead on marketing pages — pure HTML/CSS except the URL demo island
- Single repo, single dashboard — zero extra operational overhead
- Independent deploy: copy/design changes deploy in ~30s without touching app
- `client:visible` on islands means React doesn't hydrate until scrolled into view — fast initial load even with rich interactive sections

**Negative**
- Two Vercel projects to configure initially (one-time ~10 min setup)
- Monorepo root adds a `pnpm-workspace.yaml` and root `package.json` — minor overhead
- Framer Motion SSR in Astro requires `noExternal: ['framer-motion']` in Vite config — documented in `astro.config.mjs`
- Astro's partial hydration model is a new mental model if coming from Next.js — learning curve is ~1 day

## Alternatives considered

- **Next.js `(marketing)` route group** — simpler, one deploy. Rejected because: 90KB JS runtime on every marketing page, coupled deploy cadence, no zero-JS default.
- **Separate repo** — clean separation. Rejected because: two repos to manage solo, no shared docs, no shared future design system.
- **Cloudflare Pages** — excellent free tier, great CDN. Rejected because: already on Vercel Pro (multiple projects included), no reason to split platforms.
- **Remix** — good for both app and marketing. Rejected because: not meaningfully better than Next.js for static marketing content; same JS overhead problem.

## References

- [ADR-0001 — Application framework: Next.js](0001-application-framework.md) — web app remains Next.js
- [ADR-0002 — Hosting: Vercel](0002-hosting-platform.md) — both apps on same Vercel account
- [../marketing.md](../marketing.md) — marketing site architecture narrative
