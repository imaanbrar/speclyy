# ADR-0016: Shared packages (`@speclyy/db`, `@speclyy/auth`) and standalone mood board app

- **Status:** Accepted
- **Date:** 2026-04-22

## Context

Mood boards are a distinct usage pattern from the spec-building workflow. Some interior designers want a visual board tool without adopting the full Speclyy workflow (projects → groups → specs → scraper). Bundling mood boards as a `/moodboards` route inside the designer app ties the two products together in ways that hurt both:

- A standalone-boards user pays the JS bundle cost and navigation complexity of features they never use.
- A mood-board-first pricing tier would require in-app feature gating for half the navigation surface.
- Marketing "Speclyy Boards" as a distinct product is harder when it's a hidden route inside the designer app.

At the same time, mood boards share infrastructure with the designer app:

- Same Supabase project (one Postgres, one Auth).
- Same user — a designer who uses both products should sign in once.
- Same design language — both apps should look like Speclyy.
- Same product/scrape pipeline — items placed on a board can reference `scrape_cache` and `global_products` the same way `project_items` do.

The monorepo already has two deployed apps (`apps/web`, `apps/marketing`) and shares UI via `packages/design-system`. It has no shared db or auth package yet, because there was no second consumer.

## Decision

**Split mood boards into a third deployed app** at `moodboards.speclyy.com`, and **extract two new workspace packages** to share the pieces the two Next.js apps both need.

```
apps/
├── web/          → app.speclyy.com       (designer workspace)
├── moodboard/    → moodboards.speclyy.com (standalone mood boards)
└── marketing/    → speclyy.com            (landing)

packages/
├── design-system/   shared UI tokens, components, Tailwind preset
├── db/              Drizzle schema + Postgres client (NEW)
└── auth/            Supabase browser/server clients + middleware (NEW)
```

**Shared Supabase project, shared auth cookie.** Both apps point at the same Supabase project. The auth cookie is set with `Domain=.speclyy.com` so a session on one subdomain is honoured on the other. A user who signs up at `moodboards.speclyy.com` is already signed in when they visit `app.speclyy.com`.

**Shared data, scoped by query.** Mood board tables (`moodboards`, `moodboard_items`) live in the same Postgres as projects. `moodboards` has a nullable `project_id` so a standalone board can later be attached to a project without a data migration. The standalone app simply never queries the project tables; RLS enforces that users only see their own rows either way.

**Middleware as composable gates.** `@speclyy/auth/middleware` exports `updateSession`, `requireAuth`, `requireOnboarding`, `requireActiveSubscription`. Each app composes the gates it needs. The designer app uses all four; the mood board app uses only `updateSession` + `requireAuth`.

## Rationale

### Separate app over `/moodboards` route group

- **Independent pricing and marketing.** "Speclyy Boards" can have its own pricing page, onboarding, domain, and landing narrative without leaking into the designer app.
- **Independent JS bundle.** A mood-board-only user doesn't load the projects/groups/scraper code paths.
- **Independent deploy cadence.** Iterating on the canvas editor doesn't risk the designer app. Rolling back one doesn't roll back the other.
- **Independent feature gating.** If mood boards get a free tier while the designer app stays paid (or vice versa), the gate lives at the app boundary, not sprinkled through nav and routes.

### Shared packages over duplication

The alternative — copy-pasting the Supabase client and Drizzle schema into each app — breaks the moment a schema or auth policy changes. One source of truth for tables and for auth cookie configuration is the only sustainable shape with two apps.

`@speclyy/db` exports the schema and a Drizzle client factory. Callers pass the `DATABASE_URL` so the package stays pure and testable.

`@speclyy/auth` exports the Supabase clients (`server`, `browser`) and composable middleware gates. Both apps get identical cookie config by construction.

### Not Turborepo yet

ADR-0015 deferred Turborepo until shared code justified it. This ADR adds two shared packages but the build graph is still small (five workspaces total, two of which share package dependencies). Revisit when either build times cross a minute or cache reuse across CI runs is clearly valuable.

### Not two Supabase projects

Considered giving mood boards its own Supabase project. Rejected because:

- Users expect one account. Two projects means two auth databases and SSO glue.
- Attaching a standalone board to a project later requires a cross-database FK — impossible without replication.
- RLS already scopes data per-user; no isolation benefit from a second project.

## Consequences

**Positive**

- Two independent products, one shared account and one shared source of truth.
- Mood board app ships with a lighter JS bundle and a narrower attack surface (no billing endpoints, no admin routes).
- Future apps (mobile web, embedded widget) can be spun up by importing the same three packages.
- A schema change is a single PR that rebuilds both apps — no drift.

**Negative**

- Three Vercel projects and three sets of env vars to maintain. Partially mitigated by shared packages owning the config shape.
- Cross-domain cookie setup requires both subdomains under `speclyy.com` — won't work on Vercel preview URLs (`*.vercel.app`) without workarounds. Preview auth for the mood board app may need a secondary mechanism or a preview subdomain (`moodboards-preview.speclyy.com` via wildcard DNS).
- `packages/db` and `packages/auth` changes trigger rebuilds of both apps. Acceptable — those packages should change rarely and the extra build is ~30s on Vercel.
- Two codebases' worth of navigation, error states, and polish to maintain. Worth it only if mood boards is a real product with its own users, not a cosmetic split.

## Alternatives considered

- **`/moodboards` route inside `apps/web`.** Simplest. Rejected — couples pricing, bundle, and deploy cadence of two products that should be independent.
- **Separate repo for the mood board app.** Clean isolation. Rejected — would require publishing `@speclyy/db`, `@speclyy/auth`, and `@speclyy/design-system` to a registry (or Git submodules) for cross-repo consumption. Monorepo via pnpm workspaces gives the same isolation with zero publish overhead.
- **Two Supabase projects with user sync.** Total isolation. Rejected — the sync machinery is a new operational burden with no offsetting security or performance win.
- **Micro-frontend federation** (Module Federation, single-spa). Rejected — solves a different problem (embedding one app's UI inside another). We want two separate products, not one product composed from modules.

## Migration notes

At the time of this ADR, `apps/web/src/lib` does not yet exist — no db or auth code has been written in-app that needs extracting. The packages are scaffolded empty (schema barrel, client factory, middleware gate stubs) so that future db/auth code lands in the shared packages by default rather than inside a single app.

When `@speclyy/db` gains schema files, the existing `supabase/migrations/` directory in the repo root remains the source of truth for DDL — Drizzle's schema definitions are kept in sync with migrations, not used to generate them on deploy.

## References

- [ADR-0001](0001-application-framework.md) — Application framework: Next.js
- [ADR-0002](0002-hosting-platform.md) — Hosting platform: Vercel
- [ADR-0005](0005-auth-provider.md) — Auth provider: Supabase Auth
- [ADR-0006](0006-session-strategy.md) — Cookie-based SSR session via `@supabase/ssr`
- [ADR-0008](0008-orm.md) — ORM: Drizzle
- [ADR-0015](0015-marketing-site.md) — Marketing site as a second Vercel project
- [../moodboard.md](../moodboard.md) — standalone mood board app architecture
- [../deployments.md](../deployments.md) — updated monorepo structure and Vercel project list
