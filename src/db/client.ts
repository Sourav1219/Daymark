import "server-only"

import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "@/db/schema"
import { readServerEnv } from "@/lib/env/server"

export function createDatabase(
  databaseUrl: string,
  verifyTls = process.env.NODE_ENV === "production",
) {
  const client = postgres(databaseUrl, {
    connect_timeout: 10,
    idle_timeout: 20,
    max: 5,
    prepare: false,
    ...(verifyTls ? { ssl: "verify-full" as const } : {}),
  })

  return drizzle(client, { schema })
}

export type Database = ReturnType<typeof createDatabase>
type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0]
export type DatabaseExecutor = Database | DatabaseTransaction

/**
 * Runs `scope` inside a transaction that stamps the verified access context
 * into session-local settings (`app.user_id`, `app.workspace_id`). These
 * settings are the hook PostgreSQL row-level security policies use for
 * defense in depth: once policies are enabled, a query that reaches the
 * database without this context can only see rows it explicitly owns. The
 * values are transaction-local, so pooled connections never leak context
 * between requests.
 */
export async function withTenantContext<T>(
  database: Database,
  access: Readonly<{ userId: string; workspaceId: string }>,
  scope: (transaction: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  return database.transaction(async (transaction) => {
    await transaction.execute(sql`
      select set_config('app.user_id', ${access.userId}, true),
             set_config('app.workspace_id', ${access.workspaceId}, true)
    `)

    return scope(transaction)
  })
}

let database: Database | undefined

export function getDatabase(): Database {
  const env = readServerEnv()
  database ??= createDatabase(env.DATABASE_URL, env.NODE_ENV === "production")

  return database
}
