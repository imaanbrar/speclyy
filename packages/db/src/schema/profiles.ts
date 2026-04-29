import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * `public.profiles` — app-agnostic user record, 1:1 with `auth.users`.
 *
 * Rows are created by the `handle_new_user()` trigger on `auth.users` insert, so
 * application code never inserts here. `is_onboarded` is a GENERATED STORED
 * column so middleware can filter on it cheaply and without drift.
 */
export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey().notNull(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    market: text('market'),
    onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
    /**
     * GENERATED ALWAYS AS (onboarding_completed_at IS NOT NULL) STORED.
     * Drizzle can't emit `GENERATED … STORED` from the TS schema yet, so the
     * SQL migration defines the column; this field exists for typed reads.
     */
    isOnboarded: boolean('is_onboarded').notNull().default(false),
    hasVisitedDashboard: boolean('has_visited_dashboard').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    isOnboardedIdx: index('profiles_is_onboarded_idx').on(table.isOnboarded),
  }),
)

export type Profile = typeof profiles.$inferSelect
export type NewProfile = typeof profiles.$inferInsert
