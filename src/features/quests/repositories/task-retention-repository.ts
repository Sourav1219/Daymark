import "server-only"

import { and, eq, isNotNull, isNull, lte, notExists, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import type { DatabaseExecutor } from "@/db/client"
import {
  attachments,
  inAppNotifications,
  reminders,
  tasks,
  xpLedger,
} from "@/db/schema"

const childTasks = alias(tasks, "child_tasks")

/**
 * Stamps purged_at on trash rows past the retention window, mirroring the
 * user-facing permanent-delete flow (purgeQuestRecord) which keeps a
 * tombstone row instead of hard deleting.
 */
export function purgeStaleDeletedTasks(
  database: DatabaseExecutor,
  cutoff: Date,
  purgedAt: Date,
): Promise<number> {
  return database
    .update(tasks)
    .set({ purgedAt })
    .where(
      and(
        isNotNull(tasks.deletedAt),
        isNull(tasks.purgedAt),
        lte(tasks.deletedAt, cutoff),
      ),
    )
    .returning({ id: tasks.id })
    .then((rows) => rows.length)
}

/**
 * Hard deletes long-expired tombstones. Every restrict foreign key pointing
 * at tasks must be empty for a row to go; referenced rows are left for a
 * later sweep once their dependents are gone.
 */
export async function deletePurgedTaskTombstones(
  database: DatabaseExecutor,
  cutoff: Date,
): Promise<number> {
  const deleted = await database
    .delete(tasks)
    .where(
      and(
        isNotNull(tasks.purgedAt),
        lte(tasks.purgedAt, cutoff),
        notExists(
          database
            .select({ one: sql`1` })
            .from(reminders)
            .where(
              and(
                eq(reminders.questId, tasks.id),
                eq(reminders.workspaceId, tasks.workspaceId),
              ),
            ),
        ),
        notExists(
          database
            .select({ one: sql`1` })
            .from(inAppNotifications)
            .where(
              and(
                eq(inAppNotifications.questId, tasks.id),
                eq(inAppNotifications.workspaceId, tasks.workspaceId),
              ),
            ),
        ),
        notExists(
          database
            .select({ one: sql`1` })
            .from(xpLedger)
            .where(
              and(
                eq(xpLedger.questId, tasks.id),
                eq(xpLedger.workspaceId, tasks.workspaceId),
              ),
            ),
        ),
        notExists(
          database
            .select({ one: sql`1` })
            .from(attachments)
            .where(
              and(
                eq(attachments.questId, tasks.id),
                eq(attachments.workspaceId, tasks.workspaceId),
              ),
            ),
        ),
        notExists(
          database
            .select({ one: sql`1` })
            .from(childTasks)
            .where(
              and(
                eq(childTasks.parentTaskId, tasks.id),
                eq(childTasks.workspaceId, tasks.workspaceId),
              ),
            ),
        ),
      ),
    )
    .returning({ id: tasks.id })

  return deleted.length
}
