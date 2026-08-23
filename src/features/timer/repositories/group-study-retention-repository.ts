import "server-only"

import { and, inArray, isNotNull, lte } from "drizzle-orm"

import type { DatabaseExecutor } from "@/db/client"
import { groupStudyJoinRequests, groupStudySessions } from "@/db/schema"

/**
 * Deletes join requests for group study sessions that ended past the
 * retention window. Active sessions always have a null ended_at (enforced by
 * the sessions lifecycle check), so they never match.
 */
export async function deleteJoinRequestsForSessionsEndedBefore(
  database: DatabaseExecutor,
  cutoff: Date,
): Promise<number> {
  const deleted = await database
    .delete(groupStudyJoinRequests)
    .where(
      inArray(
        groupStudyJoinRequests.groupSessionId,
        database
          .select({ id: groupStudySessions.id })
          .from(groupStudySessions)
          .where(
            and(
              isNotNull(groupStudySessions.endedAt),
              lte(groupStudySessions.endedAt, cutoff),
            ),
          ),
      ),
    )
    .returning({ id: groupStudyJoinRequests.id })

  return deleted.length
}
