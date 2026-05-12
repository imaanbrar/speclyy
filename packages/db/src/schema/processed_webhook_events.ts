import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * `public.processed_webhook_events` — idempotency ledger for the Stripe
 * webhook handler.
 *
 * Stripe retries deliveries on non-2xx responses and on internal timeouts, so
 * the same `event.id` (`evt_…`) can hit `POST /api/webhooks/stripe` more than
 * once. Every event handler inserts the id into this table inside the same
 * transaction as the subscription upsert, and bails on conflict.
 *
 * `processed_at` is operational only (drift between Stripe's "delivered" and
 * our processing time); business logic should not branch on it.
 *
 * RLS is enabled with no policies — the webhook handler runs under the
 * service-role key (which bypasses RLS by design); no end user has any
 * legitimate reason to read this table.
 *
 * See:
 *   - docs/architecture/billing.md § "Webhook idempotency"
 *   - docs/implementation-tasks/billing-subscription/TASK-BILL-02-webhook-events-table.md
 *   - docs/implementation-tasks/billing-subscription/TASK-BILL-05-stripe-webhook-handler.md
 */
export const processedWebhookEvents = pgTable('processed_webhook_events', {
  stripeEventId: text('stripe_event_id').primaryKey(),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
})

export type ProcessedWebhookEvent = typeof processedWebhookEvents.$inferSelect
export type NewProcessedWebhookEvent = typeof processedWebhookEvents.$inferInsert
