import "server-only"

import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "@/db/schema"
import { readServerEnv } from "@/lib/env/server"

type PostgresClient = ReturnType<typeof postgres>

function createPostgresClient(databaseUrl: string, verifyTls: boolean) {
  return postgres(databaseUrl, {
    connect_timeout: 10,
    idle_timeout: 20,
    // The URL targets Supabase's transaction pooler. A tiny bounded pool keeps
    // background timer polling from serialising every page query behind it,
    // while remaining conservative for serverless function instances.
    max: 3,
    max_lifetime: 60,
    prepare: false,
    ...(verifyTls ? { ssl: "require" as const } : {}),
  })
}

export function createDatabase(
  databaseUrl: string,
  verifyTls = process.env.NODE_ENV === "production",
) {
  const client = createPostgresClient(databaseUrl, verifyTls)

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
let databaseClient: PostgresClient | undefined

export function getDatabase(): Database {
  const env = readServerEnv()
  if (!database || !databaseClient) {
    databaseClient = createPostgresClient(
      env.DATABASE_URL,
      env.NODE_ENV === "production",
    )
    database = drizzle(databaseClient, { schema })
  }

  return database
}

const databaseProbeTimeoutMilliseconds = 3_000

async function probeDatabase(candidate: Database): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      candidate.execute(sql`SELECT 1`),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Database liveness probe timed out")),
          databaseProbeTimeoutMilliseconds,
        )
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

/**
 * Authentication requests use an isolated connection because a serverless
 * instance can be frozen between requests, leaving a pooled TCP socket stale.
 * The preflight follows Supabase's guidance and the client is always closed
 * before the request finishes, so concurrent auth requests cannot recycle one
 * another's active connection.
 */
export async function withHealthyDatabase<T>(
  scope: (database: Database) => Promise<T>,
): Promise<T> {
  const env = readServerEnv()
  let lastError: unknown

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const client = createPostgresClient(
      env.DATABASE_URL,
      env.NODE_ENV === "production",
    )
    const candidate = drizzle(client, { schema })

    try {
      await probeDatabase(candidate)
    } catch (error) {
      lastError = error
      await client.end({ timeout: 0 })
      continue
    }

    try {
      return await scope(candidate)
    } finally {
      await client.end({ timeout: 1 })
    }
  }

  throw lastError
}
