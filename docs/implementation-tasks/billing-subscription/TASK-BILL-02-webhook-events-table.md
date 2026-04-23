---
id: TASK-BILL-02
title: Initial schema — processed_webhook_events
group: billing-subscription
status: ready
estimate: 1
dependencies: [TASK-AUTH-02]
related_screens: []
related_adrs: []
created: 2026-04-22
---

# TASK-BILL-02 — `processed_webhook_events` table

## Goal

Create the idempotency-ledger table the Stripe webhook handler uses to dedupe retries. Small, isolated schema change so the handler PR doesn't also have to do schema work.

> **Greenfield DB.** Like TASK-AUTH-02, this lands as part of the initial schema — there is no live DB to migrate against. Drizzle still records it as a migration file, but there's no rollout ceremony to plan.

## Scope

**In scope**
- DDL creating `public.processed_webhook_events` (lives in the same shared-auth schema package as TASK-AUTH-02).
- RLS enabled, no user-facing policies (service-role only writes; no reads needed from app code).
- Index discussion — PK on `stripe_event_id` is enough; no additional indexes.

**Out of scope**
- The webhook handler itself — TASK-BILL-05.
- Observability tables / logs — `operations.md` territory.

## Acceptance criteria

```gherkin
Scenario: Table exists
  Given the initial schema has been applied
  When I \d+ public.processed_webhook_events
  Then stripe_event_id is text PRIMARY KEY
  And processed_at is timestamptz NOT NULL DEFAULT now()

Scenario: RLS blocks user access
  Given the table has RLS enabled with no policies
  When an anon- or user-authenticated client selects from it
  Then zero rows are returned (RLS drops them)
  And a service_role client returns rows normally

Scenario: ON CONFLICT DO NOTHING behaves
  Given a row with stripe_event_id = 'evt_x' already exists
  When a second INSERT ... VALUES ('evt_x', now()) ON CONFLICT DO NOTHING runs
  Then row count of affected rows is 0
  And the original processed_at is unchanged
```

## Architecture references

- [`../../architecture/billing.md`](../../architecture/billing.md) § "Idempotency" — DDL is quoted verbatim there.

## Implementation notes

- **DDL:**
  ```sql
  CREATE TABLE public.processed_webhook_events (
    stripe_event_id text PRIMARY KEY,
    processed_at    timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;
  -- No policies — service-role bypasses RLS; no user-facing access needed.
  ```
- **Location.** Same schema package as TASK-AUTH-02 (shared-auth). Per [ADR-0019](../../architecture/adr/0019-multi-app-architecture.md): `subscriptions` is in the shared auth project, so this idempotency ledger belongs there too.
- **No cascading FKs.** The row is a bookkeeping artifact; it does not reference subscriptions or users.

## Review notes

- **RLS enabled without policies = no user access.** That's the intended state. Reviewer: confirm no "allow all" policy is added by reflex.
- **No retention policy yet.** Table will grow ~one row per webhook delivery. Acceptable for MVP; add a monthly prune job later if volume warrants.
- **Column set.** If a reviewer suggests adding `event_type` for observability, keep it separate — this table's job is dedup. Observability goes to logs.

## Test plan

- **Integration:** apply the schema, insert the same event ID twice with `ON CONFLICT DO NOTHING`, assert 1 row.
- **Integration (RLS):** anon client cannot read; service-role can.
- **Manual:** `\d+` inspection.
- **E2E coverage** not applicable (infrastructure).

## Open questions

- None.
