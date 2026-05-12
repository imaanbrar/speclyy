// Schema barrel. Re-export every table module here so Drizzle picks them up
// when a caller does `drizzle(sql, { schema })`.
//
// All tables live in the single Supabase project per ADR-0021 (`speclyy`).
// Today the four account-level tables (profiles, organizations,
// organization_members, subscriptions) plus the billing idempotency ledger
// (processed_webhook_events) are mirrored here for typegen; runtime
// reads/writes go through the Supabase client + RLS, not Drizzle. Future
// app-specific tables (projects, groups, items) will be added here too.

export * from './profiles'
export * from './organizations'
export * from './organization_members'
export * from './subscriptions'
export * from './processed_webhook_events'
