import 'server-only'

import { createServiceRoleSupabase } from '@speclyy/auth/service-role'

/**
 * Service-role writer for `public.subscriptions`. **Webhook handler only.**
 *
 * The webhook route is the single writer of `subscriptions` rows per the
 * billing.md "All subscription writes go through webhooks" invariant. This
 * module exists so the route handler isn't littered with the read-then-write
 * guard logic, and so the service-role client touches `subscriptions` from
 * exactly one file (easier to audit).
 *
 * ## The `updated_at` guard
 *
 * Stripe does not guarantee delivery order. A `customer.subscription.updated`
 * event with `event.created = T1` (status `past_due`) can arrive after the
 * `invoice.payment_succeeded` event with `event.created = T2 > T1` (status
 * `active`) — replays + retries make this routine.
 *
 * Every writer here:
 *   1. Reads the current row's `updated_at` (RLS-bypassing service-role read).
 *   2. Skips if `existing.updated_at >= eventCreatedAt`.
 *   3. Otherwise upserts with `updated_at = eventCreatedAt`.
 *
 * The guard is *advisory* — between the read and the upsert, another webhook
 * could land. At MVP volumes Stripe events for the same subscription arrive
 * seconds apart at minimum, so the race window is essentially never hit. If
 * it ever becomes a real issue, replace this with a Postgres function
 * (`upsert_subscription_if_newer`) so the read + write are one statement.
 *
 * Note that we deliberately **do not** call Drizzle's `onConflictDoUpdate`
 * here. The architecture-doc snippet shows that pattern, but Drizzle is
 * typegen-only at runtime today (every other write goes through the Supabase
 * client). Keeping the webhook handler on the same surface trades a tiny race
 * window for one fewer runtime dependency.
 *
 * See:
 *   - docs/architecture/billing.md § "Out-of-order events"
 *   - docs/implementation-tasks/billing-subscription/TASK-BILL-05-stripe-webhook-handler.md
 */

export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'

export interface UpsertSubscriptionInput {
  userId: string
  status: SubscriptionStatus
  currentPeriodEnd: Date | null
  stripeCustomerId: string
  stripeSubscriptionId: string
  /**
   * Stripe `event.created` for this update, as a `Date`. Used both as the new
   * `updated_at` value and as the guard threshold against the existing row.
   */
  eventCreatedAt: Date
}

export interface SubscriptionWriteResult {
  /** True iff a row was inserted or updated. False on dedup-by-newer-state. */
  wrote: boolean
  /**
   * Reason a write was skipped (for structured logging).
   *
   * - `newer_state_present` — `existing.updated_at >= eventCreatedAt`. Out-of-
   *   order replay; the in-DB state already reflects a newer event. Safe.
   * - `no_row_yet` — status-only update (`setSubscriptionStatusIfNewer`) but
   *   no `subscriptions` row exists for this user. Means a `payment_failed`
   *   or `subscription.deleted` event arrived before the matching
   *   `subscription.created`. The signal is permanently dropped (the dedup
   *   row was just inserted and Stripe won't replay). The reconciliation
   *   cron is the post-MVP backstop. Caller logs at `warn` so it's spotable.
   */
  skipReason?: 'newer_state_present' | 'no_row_yet'
}

/**
 * Idempotent: "active" entitlement payload future apps can read.
 *
 * Hardcoded to `{ speclyy: { plan: 'pro' } }` for MVP. Future apps add their
 * own keys; this writer never *clears* other apps' keys, only adds/overwrites
 * `speclyy`.
 */
const PRO_ENTITLEMENT = { speclyy: { plan: 'pro' } } as const

/**
 * Upsert the `subscriptions` row for a user, guarded by `updated_at`.
 *
 * Caller is responsible for resolving `userId` from `metadata.userId` on the
 * Stripe object before invoking. If the metadata is missing, the caller
 * should log + return 200 (alert-worthy) without calling this.
 */
export async function upsertSubscriptionState(
  input: UpsertSubscriptionInput,
): Promise<SubscriptionWriteResult> {
  const supabase = createServiceRoleSupabase()

  const { data: existing, error: readErr } = await supabase
    .from('subscriptions')
    .select('updated_at, entitlements')
    .eq('user_id', input.userId)
    .maybeSingle()

  if (readErr) {
    // Surface so the route handler returns 5xx and Stripe retries. A read
    // failure here is real infra trouble, not a logic bug.
    throw readErr
  }

  if (existing && new Date(existing.updated_at) >= input.eventCreatedAt) {
    return { wrote: false, skipReason: 'newer_state_present' }
  }

  // Only set the entitlement when transitioning to (or staying) active.
  // Lapsed subs (past_due, canceled, incomplete) clear the speclyy entitlement
  // so downstream `isPro()` checks (TASK-BILL-08) are wrong by default rather
  // than wrong by stale data.
  const existingEntitlements = (existing?.entitlements ?? {}) as Record<string, unknown>
  const nextEntitlements: Record<string, unknown> =
    input.status === 'active'
      ? { ...existingEntitlements, ...PRO_ENTITLEMENT }
      : (() => {
          const { speclyy: _drop, ...rest } = existingEntitlements
          void _drop
          return rest
        })()

  const { error: writeErr } = await supabase.from('subscriptions').upsert(
    {
      user_id: input.userId,
      status: input.status,
      current_period_end: input.currentPeriodEnd?.toISOString() ?? null,
      stripe_customer_id: input.stripeCustomerId,
      stripe_subscription_id: input.stripeSubscriptionId,
      entitlements: nextEntitlements,
      updated_at: input.eventCreatedAt.toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (writeErr) throw writeErr
  return { wrote: true }
}

/**
 * Status-only update (for `invoice.payment_failed`, `subscription.deleted`).
 *
 * Same `updated_at` guard as `upsertSubscriptionState`. Skips silently if no
 * row exists — the matching `customer.subscription.created` event must always
 * land first, and if it hasn't, this is a noop until the row appears (Stripe
 * will retry the create eventually, or the reconciliation cron will fill it).
 */
export async function setSubscriptionStatusIfNewer(input: {
  userId: string
  status: SubscriptionStatus
  currentPeriodEnd?: Date | null
  eventCreatedAt: Date
}): Promise<SubscriptionWriteResult> {
  const supabase = createServiceRoleSupabase()

  const { data: existing, error: readErr } = await supabase
    .from('subscriptions')
    .select('updated_at, entitlements')
    .eq('user_id', input.userId)
    .maybeSingle()

  if (readErr) throw readErr
  if (!existing) {
    // No row to update. Means a `payment_failed` / `subscription.deleted`
    // event arrived before its matching `subscription.created` event — Stripe
    // ordering can do this on retries. The dedup row was already inserted by
    // the route handler, so Stripe won't replay this event; the signal is
    // gone until the reconciliation cron lands (post-MVP). Distinct
    // skipReason so the route logs this at `warn` instead of `skipped` —
    // routine state-newer dedup vs. a real (rare) data loss.
    return { wrote: false, skipReason: 'no_row_yet' }
  }
  if (new Date(existing.updated_at) >= input.eventCreatedAt) {
    return { wrote: false, skipReason: 'newer_state_present' }
  }

  const existingEntitlements = (existing.entitlements ?? {}) as Record<string, unknown>
  const nextEntitlements: Record<string, unknown> =
    input.status === 'active'
      ? { ...existingEntitlements, ...PRO_ENTITLEMENT }
      : (() => {
          const { speclyy: _drop, ...rest } = existingEntitlements
          void _drop
          return rest
        })()

  const update: Record<string, unknown> = {
    status: input.status,
    entitlements: nextEntitlements,
    updated_at: input.eventCreatedAt.toISOString(),
  }
  if (input.currentPeriodEnd !== undefined) {
    update.current_period_end = input.currentPeriodEnd?.toISOString() ?? null
  }

  const { error: writeErr } = await supabase
    .from('subscriptions')
    .update(update)
    .eq('user_id', input.userId)

  if (writeErr) throw writeErr
  return { wrote: true }
}

/**
 * Insert into `processed_webhook_events`; returns `false` if the event was
 * already processed (PK conflict), `true` if this is the first time we've
 * seen it.
 *
 * The handler MUST call this before running any event handler, and bail
 * (return 200) when it returns `false`.
 */
export async function recordEventProcessed(stripeEventId: string): Promise<boolean> {
  const supabase = createServiceRoleSupabase()
  const { error } = await supabase
    .from('processed_webhook_events')
    .insert({ stripe_event_id: stripeEventId })

  if (!error) return true

  // Postgres unique-violation. Supabase exposes it as Postgrest code 23505.
  // Anything else is real and should bubble up so Stripe retries.
  const code = (error as { code?: string }).code
  if (code === '23505') return false
  throw error
}
