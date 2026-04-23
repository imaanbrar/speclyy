// Schema barrel. Re-export every table module here so Drizzle picks them up
// when a caller does `drizzle(sql, { schema })`.
//
// Tables live in the shared auth Supabase project (see ADR-0019). Per-app
// tables (projects, groups, items) will live in a separate package / DB.

export * from './profiles'
export * from './organizations'
export * from './organization_members'
export * from './subscriptions'
