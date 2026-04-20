# ADR-0005: Auth provider — Supabase Auth

- **Status:** Accepted
- **Date:** 2026-04-20

## Context

Speclyy needs user authentication. Per MVP decisions:
- **Google OAuth only** — no email/password, no magic links
- Single sign-in method
- 7-day free trial, flat monthly subscription via Stripe after trial

ADR-0004 committed us to Supabase as the database host. This *defaults* us to Supabase Auth (GoTrue), but the decision is not automatic — Clerk and Auth0 are standard choices for layering richer auth onto a Postgres backend.

## Decision

Use **Supabase Auth (GoTrue)** with Google OAuth as the sole sign-in method.

## Rationale

**Native RLS integration.** Row-Level Security policies in Postgres reference `auth.uid()` directly, tying tenant isolation to the database layer with no glue code. With Clerk or Auth0 we'd configure JWT templates and custom Postgres functions to read user IDs from external claims — more surface area, more failure modes.

**Zero integration cost.** Supabase Auth ships with the Supabase project we already have. No second vendor, no webhook sync to mirror users into our DB, no second dashboard.

**Sufficient feature set for MVP.** Google OAuth, session management, user admin, and email templating are all covered. Features we don't have (polished pre-built UI, organizations, enterprise SSO) we don't need yet.

**Cost bundled into Supabase Pro.** No incremental MAU pricing at our scale.

**Low swap cost.** If we outgrow Supabase Auth, migration to Clerk or Auth0 means (a) rewriting RLS policies to read user ID from a custom JWT claim and (b) running a one-time user export/import. A week of work, not a rewrite.

## Consequences

**Positive**
- RLS `USING (user_id = auth.uid())` gives tenant isolation in one line per table.
- Single vendor for DB + auth — one billing relationship, one support channel, one integration surface.
- Google OAuth setup is well-documented; initial wiring is under an hour.

**Negative**
- Pre-built sign-in UI is basic. We build our own `/sign-in` page (fine — it's one button).
- User-management dashboard is less polished than Clerk's. Acceptable at solo-dev scale.
- Auth coupling to Supabase — provider swap later means rewriting RLS policies (~1 week).

## Alternatives considered

- **Clerk** — Polished drop-in UI (`<SignIn>`, `<UserButton>`), Next.js-idiomatic, excellent DX. Rejected because: RLS integration requires JWT template + custom Postgres function; adds $25/mo and a second vendor; integration work for a solo dev isn't justified by nicer UI on a one-button sign-in page. Revisit if we outgrow Supabase Auth's admin UX ceiling or need Organizations.
- **Auth0** — Mature IDaaS with deep enterprise features (SAML/AD SSO, Actions hooks, M2M tokens, rich admin APIs). Rejected because: overkill for single-provider consumer OAuth; pricing climbs sharply past MVP tier; Universal Login redirect is a less modern UX than embedded sign-in; same RLS integration friction as Clerk. Reasonable future choice if we need enterprise SSO for B2B customers.
- **NextAuth / Auth.js** — Free and flexible. Rejected because: pushes significant session + DB plumbing into our codebase, RLS integration is custom work, and we'd still manage OAuth app registration and session tables ourselves. No net advantage over Supabase Auth for our use case.
