// Schema barrel. Re-export every table module here so Drizzle picks them up
// when a caller does `drizzle(sql, { schema })`.
//
// Tables to add as they land:
//   - profiles
//   - subscriptions
//   - projects, project_groups, project_items
//   - scrape_cache, global_products
