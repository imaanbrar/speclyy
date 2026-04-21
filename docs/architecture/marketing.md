# Marketing Site — Architecture

How `speclyy.com` is built, structured, and deployed. For the *why* behind framework and hosting decisions, see [ADR-0015](adr/0015-marketing-site.md).

---

## Overview

```
speclyy.com         → apps/marketing/  (Astro, static)  → Vercel project: speclyy-marketing
app.speclyy.com     → apps/web/        (Next.js)         → Vercel project: speclyy-web
```

Both live in the same Git repository under `apps/`. Vercel detects the affected app on push and only rebuilds it.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Astro 5 (static output) | Zero JS by default, Islands architecture, built-in image pipeline |
| Interactive components | React Islands (`@astrojs/react`) | Framer Motion for animated sections, URL demo widget |
| Styling | Tailwind CSS | Same as the app — shared mental model |
| Scroll animations | GSAP ScrollTrigger | Industry standard for scroll-driven marketing animations |
| Images | Astro `<Image />` | Sharp, WebP, responsive srcset — automatic |
| Hosting | Vercel (`@astrojs/vercel/static`) | Same account as app, zero extra overhead |

---

## Islands architecture

Astro's key concept: components are static (zero JS) unless you explicitly opt into hydration.

```astro
<!-- Static Astro component — zero JS, renders to HTML -->
<FeatureCard title="URL extraction" />

<!-- React Island — hydrates only when visible in viewport -->
<UrlDemoIsland client:visible />

<!-- React Island — hydrates immediately on page load -->
<PricingToggle client:load />
```

**Hydration directives:**

| Directive | When it hydrates | Use for |
|---|---|---|
| `client:load` | Immediately | Above-fold interactive (nav mobile menu) |
| `client:visible` | When scrolled into viewport | Below-fold demos, animations |
| `client:idle` | When browser is idle | Low-priority enhancements |
| *(none)* | Never | Everything else — 95% of the page |

---

## File structure

```
apps/marketing/
├── astro.config.mjs          ← Vercel adapter + React + Tailwind
├── tailwind.config.mjs       ← brand tokens, animation keyframes
├── tsconfig.json
├── public/
│   ├── favicon.svg
│   └── og-default.png        ← fallback Open Graph image
└── src/
    ├── env.d.ts
    ├── styles/
    │   └── global.css        ← Tailwind base + component classes (.btn-primary, .section)
    ├── layouts/
    │   └── Layout.astro      ← HTML shell, meta tags, OG, fonts
    ├── pages/
    │   ├── index.astro       ← Landing page (composes sections)
    │   ├── privacy.astro     ← Privacy policy (static)
    │   └── terms.astro       ← Terms of service (static)
    ├── sections/             ← Full-width page sections (pure Astro)
    │   ├── Hero.astro
    │   ├── Problem.astro
    │   ├── HowItWorks.astro
    │   ├── Features.astro
    │   ├── Pricing.astro
    │   └── Footer.astro
    └── components/
        ├── Nav.astro         ← Static nav (no JS)
        └── islands/          ← React Islands — only what needs interactivity
            ├── UrlDemoIsland.tsx   ← Interactive URL paste demo
            └── PricingToggle.tsx   ← Monthly/annual toggle (add when needed)
```

**Rule:** If a component doesn't need `useState`, `useEffect`, or an event listener — it's an Astro component, not a React Island. Keeps the JS bundle minimal.

---

## Landing page sections

| Section | Purpose | JS? |
|---|---|---|
| `Nav` | Fixed navigation with CTA | Static (mobile menu can be CSS-only with `<details>`) |
| `Hero` | Headline, subhead, CTAs, product screenshot | Static + CSS animations |
| `Problem` | Pain point cards | Static |
| `HowItWorks` | 3-step process + live URL demo | Static + **UrlDemoIsland** (React) |
| `Features` | Feature grid | Static |
| `Pricing` | Single plan card | Static |
| `Footer` | Links, copyright | Static |

Total hydrated components at launch: **1** (UrlDemoIsland).

---

## Animations

### CSS animations (zero JS)
Used for entrance animations — hero headline, cards fading in.

```css
/* tailwind.config.mjs keyframes */
fadeUp: {
  from: { opacity: 0, transform: 'translateY(20px)' },
  to:   { opacity: 1, transform: 'translateY(0)' },
}
```

```astro
<!-- Apply with Tailwind utility + delay -->
<h1 class="animate-fade-up">...</h1>
<p  class="animate-fade-up [animation-delay:100ms]">...</p>
```

### GSAP ScrollTrigger (scroll-driven)
For sections that animate as they scroll into view — staggered feature cards, timeline reveals.

```ts
// Loaded only on pages that use it — no global bundle cost
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
gsap.registerPlugin(ScrollTrigger)

gsap.from('.feature-card', {
  y: 40,
  opacity: 0,
  duration: 0.6,
  stagger: 0.1,
  scrollTrigger: {
    trigger: '.features-section',
    start: 'top 80%',
  },
})
```

Wrap GSAP in a `<script>` tag inside an Astro component — Astro bundles and tree-shakes it correctly.

### Framer Motion (React Islands only)
Used inside React Islands for component-level animations (field populate demo, pricing toggle).

```tsx
// Inside UrlDemoIsland.tsx
import { motion, AnimatePresence } from 'framer-motion'

<motion.span
  initial={{ opacity: 0, x: 6 }}
  animate={{ opacity: 1, x: 0 }}
>
  {field.value}
</motion.span>
```

---

## Images

Use Astro's `<Image />` component everywhere. Never use raw `<img>` tags for content images.

```astro
---
import { Image } from 'astro:assets'
import productScreenshot from '@/assets/product-screenshot.png'
---

<Image
  src={productScreenshot}
  alt="Speclyy project dashboard"
  width={1280}
  height={800}
  loading="eager"    ← above the fold: eager. below the fold: lazy (default)
  quality={90}
  class="w-full rounded-2xl"
/>
```

**What Astro does automatically:**
- Converts to WebP (or AVIF if configured)
- Generates responsive `srcset` for multiple breakpoints
- Adds `width` + `height` attributes (prevents layout shift)
- Lazy loads by default (`loading="lazy"`)

---

## Vercel setup

Two projects, one Git repo, one team:

| | speclyy-marketing | speclyy-web |
|---|---|---|
| Root Directory | `apps/marketing` | `apps/web` |
| Framework | Astro | Next.js |
| Domain | `speclyy.com`, `www.speclyy.com` | `app.speclyy.com` |
| Build command | `pnpm build` | `pnpm build` |
| Output directory | `dist` | `.next` |

**Git push behaviour:** Vercel detects which files changed. A push that only touches `apps/marketing/` only triggers a marketing rebuild. A push that touches both triggers both. No GitHub Actions needed — Vercel handles it.

---

## Local development

```bash
# Install all workspace dependencies from repo root
pnpm install

# Run marketing site only
pnpm dev:marketing
# → http://localhost:4321

# Run app only
pnpm dev:web
# → http://localhost:3000

# Both simultaneously (two terminals, or use a process manager)
pnpm dev:marketing &
pnpm dev:web
```

---

## SEO

All meta tags, Open Graph, and Twitter cards are in `Layout.astro` — one place to update.

```astro
<!-- Every page passes its own title + description -->
<Layout
  title="Speclyy — The product OS for interior designers"
  description="Paste a URL, get a filled spec sheet."
  ogImage="/og-landing.png"
>
```

**Sitemap:** Astro's `@astrojs/sitemap` integration generates `sitemap.xml` automatically on build. Add it when content pages are added.

---

## When to add Turborepo

Add Turborepo when:
- A shared `packages/ui` (design tokens, shared components) is extracted
- Build times become slow and caching would help
- More than one developer needs reproducible builds

At MVP with two apps and no shared packages, `pnpm workspaces` alone is sufficient.

---

## References

- [ADR-0015 — Marketing site: Astro + Vercel monorepo](adr/0015-marketing-site.md)
- [ADR-0001 — Application framework: Next.js](adr/0001-application-framework.md)
- [ADR-0002 — Hosting: Vercel](adr/0002-hosting-platform.md)
- [application.md](application.md) — Next.js app architecture
