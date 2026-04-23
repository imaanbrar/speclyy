import { check, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { profiles } from './profiles'

/**
 * `public.subscriptions` — per-user Stripe state with a jsonb `entitlements`
 * column keyed by app.
 *
 * Free users have NO row in this table — only paid subscribers. `user_id` is
 * UNIQUE to encode the one-subscription-per-user MVP invariant (ADR-0017) and
 * to serve as the conflict target for the Stripe webhook's upsert.
 */
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    stripeCustomerId: text('stripe_customer_id').unique(),
    stripeSubscriptionId: text('stripe_subscription_id').unique(),
    promoCodeId: uuid('promo_code_id'),
    entitlements: jsonb('entitlements').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    userIdIdx: index('subscriptions_user_id_idx').on(table.userId),
    statusCheck: check(
      'subscriptions_status_check',
      sql`${table.status} IN ('active','past_due','canceled','incomplete','incomplete_expired')`,
    ),
  }),
)

export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert
