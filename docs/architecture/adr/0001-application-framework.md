# ADR-0001: Application framework — Next.js

- **Status:** Accepted
- **Date:** 2026-04-20

## Context

Speclyy is a responsive web app built by a solo developer (plus one future collaborator). Surface area includes a marketing site, authenticated dashboard, project editor with heavy interactive state, server-side integrations (Supabase, Stripe, Claude API, scraper webhooks), and server-side PDF generation.

We need a framework that:
- Runs one codebase for marketing + app + API
- Supports SSR / RSC for fast initial paint on project pages
- Has a mature deploy story and a large hiring pool
- Does not lock us to one host

## Decision

Use **Next.js 15 (App Router)** with **React Server Components** for reads and **Server Actions** for mutations.

## Rationale

**Fit with Speclyy's surface area.** Marketing pages, onboarding, dashboard, project editor, and integration endpoints all live in one app. Next.js covers SSR for SEO-critical marketing, SPA-like interactivity for the dashboard, and server endpoints for Stripe/Supabase/Claude webhooks — without splitting the codebase three ways.

**RSC fits the data shape.** Project pages render structured, nested data (project → groups → items → finishes). Server Components render this on the server and stream HTML; only the interactive parts ship JS. A SPA would ship a query client, hydration data, and loading states for the same payload.

**Server Actions reduce glue code.** Forms like *save product*, *create group*, *update finish* post to typed server functions. No hand-rolled REST routes, no client-side fetch wrappers, no manual type sync. For solo-dev velocity this compounds.

**Ecosystem alignment with every dependency we've picked.** First-class patterns exist for Supabase SSR auth, Stripe Checkout + webhook handlers, Claude SDK on the Node runtime, and React-PDF server rendering. None of this is bleeding-edge.

**Middleware handles cross-cutting gates.** Auth redirect, trial-expired gate, and onboarding-incomplete redirect all live in `middleware.ts` — no reverse proxy needed.

**Performance defaults that matter for a designer tool.** Built-in `<Image>` with automatic WebP/AVIF and responsive sizes (product thumbnails are our heaviest asset). Route-level code splitting keeps the dashboard bundle small as the app grows.

**Deploy optionality.** First-class on Vercel (ADR-0002) but portable as a Docker image to Fargate, Azure Container Apps, or Fly.io. OpenNext provides a pure-AWS or Cloudflare Workers escape hatch.

**Hiring pool.** Largest React meta-framework — easiest to recruit for if the team grows past two.

## Consequences

**Positive**
- Single repo covers marketing, app UI, and API layer — minimal context switching for solo dev.
- RSC keeps client bundles small even as the project editor grows.
- Portable — no lock-in to host.
- Every major integration has a well-documented Next.js pattern.

**Negative**
- App Router and RSC are still maturing; some UI libraries (drag-and-drop, rich text) require careful `"use client"` boundaries.
- Server Actions couple UI and server code tightly — acceptable for solo-dev velocity, revisit if a separate backend team materializes.
- Aggressive release cadence means we'll pin versions and budget occasional upgrade days.

## Alternatives considered

- **Remix** — Nested routing and loaders/actions are elegant. Rejected because ecosystem momentum, RSC maturity, and hiring pool all sit with Next. No reason to take a smaller-community bet.
- **SPA (Vite + React) + separate API (Express/Fastify)** — Clean separation, familiar pattern. Rejected because: two deploys, two CI pipelines, manual typesafety across the boundary, worse first-load for project pages, and marketing SEO needs a third solution.
- **Astro + islands** — Excellent for marketing sites but weak for a stateful SaaS dashboard. Rejected because the authenticated app is most of the product; optimizing for the marketing slice would be backwards.
- **RedwoodJS / Blitz** — More opinionated but smaller communities and uncertain roadmaps. Rejected on ecosystem risk.
