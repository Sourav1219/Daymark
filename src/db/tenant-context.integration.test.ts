// @vitest-environment node

import { randomUUID } from "node:crypto"

import { sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  createDatabase,
  type Database,
  type DatabaseExecutor,
} from "@/db/client"

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const integrationDescribe = testDatabaseUrl
  ? describe.sequential
  : describe.skip

async function readSetting(
  database: DatabaseExecutor,
  name: string,
): Promise<string | null> {
  const result = await database.execute(
    sql`select current_setting(${name}, true) as value`,
  )
  const rows = (
    Array.isArray(result) ? result : (result as { rows: unknown[] }).rows
  ) as ReadonlyArray<{ value: string | null }>
  // A committed transaction-local GUC reads back as an empty string, not
  // NULL; policies must treat both as "no context" (see nullif usage).
  const value = rows[0]?.value ?? null
  return value === "" ? null : value
}

integrationDescribe("tenant context settings", () => {
  let database: Database

  beforeAll(() => {
    if (!testDatabaseUrl) {
      throw new Error("TEST_DATABASE_URL is required for integration tests")
    }
    database = createDatabase(testDatabaseUrl)
  })

  afterAll(async () => {
    if (database) await database.$client.end({ timeout: 2 })
  })

  it("stamps transaction-local context visible inside and gone after commit", async () => {
    const userId = randomUUID()
    const workspaceId = randomUUID()

    // Outside any transaction the settings are unset.
    expect(await readSetting(database, "app.user_id")).toBeNull()
    expect(await readSetting(database, "app.workspace_id")).toBeNull()

    await database.transaction(async (transaction) => {
      await transaction.execute(sql`
        select set_config('app.user_id', ${userId}, true),
               set_config('app.workspace_id', ${workspaceId}, true)
      `)
      expect(await readSetting(transaction, "app.user_id")).toBe(userId)
      expect(await readSetting(transaction, "app.workspace_id")).toBe(
        workspaceId,
      )
    })

    // Transaction-local settings vanish on commit even though the pooled
    // connection is reused, so context can never leak between requests.
    expect(await readSetting(database, "app.user_id")).toBeNull()
    expect(await readSetting(database, "app.workspace_id")).toBeNull()
  })

  it("rolls back stamped context with the transaction", async () => {
    try {
      await database.transaction(async (transaction) => {
        await transaction.execute(sql`
          select set_config('app.user_id', 'rollback-user', true)
        `)
        expect(await readSetting(transaction, "app.user_id")).toBe(
          "rollback-user",
        )
        throw new Error("intentional rollback")
      })
    } catch {
      // Expected.
    }

    expect(await readSetting(database, "app.user_id")).toBeNull()
  })
})
