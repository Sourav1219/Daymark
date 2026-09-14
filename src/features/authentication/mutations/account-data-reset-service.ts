import "server-only"

import { eq } from "drizzle-orm"

import type { Database } from "@/db/client"
import {
  activityEvents,
  attachments,
  gates,
  groupStudyJoinRequests,
  groupStudyParticipants,
  groupStudySessions,
  inAppNotifications,
  labels,
  questLabels,
  reminderDeliveries,
  reminders,
  tasks,
  timerSessions,
  userProgression,
  xpLedger,
} from "@/db/schema"
import type { AccessContext } from "@/features/authentication/authorization/access-context"

export type AccountDataResetSummary = Readonly<{
  attachmentKeys: readonly string[]
}>

/**
 * Removes the authenticated user's personal content while preserving their
 * identity, workspace, settings, consent records, and active sessions.
 *
 * The reset is transactional so a foreign-key or database failure cannot
 * leave the account half-reset. Rows shared with another person's workspace
 * are not treated as this user's personal content.
 */
export async function resetUserContentData(
  database: Database,
  access: AccessContext,
): Promise<AccountDataResetSummary> {
  return database.transaction(async (transaction) => {
    const attachmentRows = await transaction
      .select({ storageKey: attachments.storageKey })
      .from(attachments)
      .where(eq(attachments.workspaceId, access.workspaceId))

    // Closing rooms hosted from the personal workspace cascades their room
    // activity. Remove the user's participation in rooms hosted elsewhere
    // before deleting the timer records pinned by those participation rows.
    await transaction
      .delete(groupStudySessions)
      .where(eq(groupStudySessions.workspaceId, access.workspaceId))
    await transaction
      .delete(groupStudyJoinRequests)
      .where(eq(groupStudyJoinRequests.userId, access.userId))
    await transaction
      .delete(groupStudyParticipants)
      .where(eq(groupStudyParticipants.userId, access.userId))
    await transaction
      .delete(timerSessions)
      .where(eq(timerSessions.userId, access.userId))

    // Notifications and delivery attempts restrict reminder deletion.
    await transaction
      .delete(inAppNotifications)
      .where(eq(inAppNotifications.workspaceId, access.workspaceId))
    await transaction
      .delete(reminderDeliveries)
      .where(eq(reminderDeliveries.workspaceId, access.workspaceId))
    await transaction
      .delete(reminders)
      .where(eq(reminders.workspaceId, access.workspaceId))

    await transaction
      .delete(attachments)
      .where(eq(attachments.workspaceId, access.workspaceId))

    // Ledger entries pin both activity events and quests, so progression is
    // removed before workspace content. Re-seed the owner's zeroed projection
    // in the same transaction to make the fresh-start state explicit.
    await transaction
      .delete(xpLedger)
      .where(eq(xpLedger.workspaceId, access.workspaceId))
    await transaction
      .delete(activityEvents)
      .where(eq(activityEvents.workspaceId, access.workspaceId))
    await transaction
      .delete(userProgression)
      .where(eq(userProgression.workspaceId, access.workspaceId))

    await transaction
      .delete(questLabels)
      .where(eq(questLabels.workspaceId, access.workspaceId))
    await transaction
      .delete(tasks)
      .where(eq(tasks.workspaceId, access.workspaceId))
    await transaction
      .delete(labels)
      .where(eq(labels.workspaceId, access.workspaceId))
    await transaction
      .delete(gates)
      .where(eq(gates.workspaceId, access.workspaceId))

    await transaction.insert(userProgression).values({
      userId: access.userId,
      workspaceId: access.workspaceId,
    })

    return {
      attachmentKeys: attachmentRows.map((row) => row.storageKey),
    }
  })
}
