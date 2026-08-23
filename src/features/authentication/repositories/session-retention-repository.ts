import "server-only"

import { lte } from "drizzle-orm"

import type { DatabaseExecutor } from "@/db/client"
import { sessions } from "@/db/schema"

/**
 * Deletes better-auth sessions that expired at least the retention window
 * ago. Unexpired sessions and recently expired ones are kept so users can
 * still see their own device list.
 */
export async function deleteExpiredAuthSessionsBefore(
  database: DatabaseExecutor,
  cutoff: Date,
): Promise<number> {
  const deleted = await database
    .delete(sessions)
    .where(lte(sessions.expiresAt, cutoff))
    .returning({ id: sessions.id })

  return deleted.length
}
