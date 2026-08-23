import "server-only"

import { and, eq, lte, notExists, sql } from "drizzle-orm"

import type { DatabaseExecutor } from "@/db/client"
import { activityEvents, xpLedger } from "@/db/schema"

/**
 * Deletes activity events older than the retention window that are no longer
 * referenced by the append-only XP ledger; ledger rows restrict-delete
 * against their activity event, so referenced events wait for a later sweep.
 */
export function deleteActivityEventsBefore(
  database: DatabaseExecutor,
  cutoff: Date,
): Promise<number> {
  return database
    .delete(activityEvents)
    .where(
      and(
        lte(activityEvents.occurredAt, cutoff),
        notExists(
          database
            .select({ one: sql`1` })
            .from(xpLedger)
            .where(
              and(
                eq(xpLedger.activityEventId, activityEvents.id),
                eq(xpLedger.workspaceId, activityEvents.workspaceId),
              ),
            ),
        ),
      ),
    )
    .returning({ id: activityEvents.id })
    .then((rows) => rows.length)
}
