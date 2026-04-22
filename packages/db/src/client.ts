import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export function createDbClient(databaseUrl: string) {
  const sql = postgres(databaseUrl, { prepare: false })
  return drizzle(sql, { schema })
}

export type DbClient = ReturnType<typeof createDbClient>
