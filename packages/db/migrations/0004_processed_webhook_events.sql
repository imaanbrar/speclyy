-- =============================================================================
-- Speclyy DB — `processed_webhook_events` for Stripe webhook idempotency
-- Target project: `speclyy` (Supabase) — single project per ADR-0021
-- =============================================================================
--
-- Stripe retries deliveries on non-2xx responses and on its own internal
-- timeouts, so the same `event.id` can land on `POST /api/webhooks/stripe`
-- multiple times. The handler must be idempotent: every event handler first
-- inserts the event id into this table inside the same transaction as the
-- subscription upsert, and bails on conflict.
--
-- Schema is intentionally minimal — primary key + observed-at timestamp:
--
--   stripe_event_id text PRIMARY KEY  -- Stripe's `evt_…`, globally unique
--   processed_at    timestamptz       -- when we first wrote the row
--
-- The `processed_at` column is for operational debugging only (drift between
-- "Stripe says delivered" in the dashboard vs when we processed it). It is
-- not used for business logic.
--
-- RLS: enabled with NO policies. The webhook handler runs under the
-- service-role key (which bypasses RLS by design), and no end user has any
-- legitimate reason to read this table. Enabling RLS without policies makes
-- "denied for everyone except service-role" the explicit posture rather than
-- relying on the implicit Supabase default.
--
-- See:
--   - docs/architecture/billing.md § "Webhook idempotency"
--   - docs/implementation-tasks/billing-subscription/TASK-BILL-02-webhook-events-table.md
--   - docs/implementation-tasks/billing-subscription/TASK-BILL-05-stripe-webhook-handler.md
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  stripe_event_id text PRIMARY KEY,
  processed_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies. Service-role bypasses RLS; no user-facing access.

COMMIT;
