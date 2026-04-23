import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * `public.organizations` — account-level entity with a `type` discriminator.
 *
 * For Speclyy v1 only 'individual' and 'studio' are produced during onboarding.
 * No UNIQUE constraint on `name` — two orgs may legitimately share a name.
 */
export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    type: text('type').notNull(),
    size: text('size'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    typeIdx: index('organizations_type_idx').on(table.type),
    typeCheck: check(
      'organizations_type_check',
      sql`${table.type} IN ('individual','studio','firm','team')`,
    ),
    sizeCheck: check(
      'organizations_size_check',
      sql`${table.size} IS NULL OR ${table.size} IN ('solo','2_5','6_10','11_plus')`,
    ),
  }),
)

export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert
