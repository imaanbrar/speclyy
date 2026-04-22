# @speclyy/db

Shared database layer. Every app that talks to Postgres imports from here.

## Contents

- `src/schema/` — Drizzle table definitions (one file per domain: `profiles`, `projects`, `moodboards`, `subscriptions`, …).
- `src/client.ts` — Drizzle client factory. Accepts a `DATABASE_URL` and returns a typed client.
- `src/index.ts` — Public re-exports.

## Usage

```ts
import { db } from '@speclyy/db/client'
import { moodboards } from '@speclyy/db/schema'

const rows = await db.select().from(moodboards).where(...)
```

## Rules

- **Schema is the source of truth.** Migrations are generated from these tables via `drizzle-kit`.
- **No env var reads inside this package.** Callers pass `DATABASE_URL` explicitly — keeps the package usable from Server Actions, Route Handlers, the scraper, and tests.
- **No Supabase client here.** That lives in `@speclyy/auth`. This package is pure Postgres / Drizzle.
