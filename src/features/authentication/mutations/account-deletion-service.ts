import "server-only"

import { eq, inArray } from "drizzle-orm"

import type { Database } from "@/db/client"
import {
  activityEvents,
  attachments,
  gates,
  groupStudyParticipants,
  groupStudySessions,
  inAppNotifications,
  labels,
  pushSubscriptions,
  questLabels,
  reminderDeliveries,
  reminders,
  tasks,
  timerSessions,
  userProgression,
  users,
  workspaces,
  xpLedger,
} from "@/db/schema"

export type AccountPurgeSummary = Readonly<{
  attachmentKeys: readonly string[]
  personalWorkspaceIds: readonly string[]
}>

/**
 * Deletes the user together with every owned domain record in one
 * transaction. The order respects the restrict-style foreign keys: group
 * study participation is removed before timer sessions, hosted rooms before
 * the user, workspace content before the workspace, and the workspace before
 * the user row. Attachment storage keys are returned so the caller can remove
 * private R2 objects after the database commit.
 */
export async function deleteUserAndOwnedData(
  database: Database,
  userId: string,
): Promise<AccountPurgeSummary> {
  return database.transaction(async (transaction) => {
    const ownedWorkspaces = await transaction
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.ownerUserId, userId))
    const personalWorkspaceIds = ownedWorkspaces.map(
      (workspace) => workspace.id,
    )

    const attachmentRows = await transaction
      .select({ storageKey: attachments.storageKey })
      .from(attachments)
      .where(eq(attachments.uploadedByUserId, userId))

    // Participation rows pin timer sessions; remove them first, including
    // memberships in rooms hosted by other users.
    await transaction
      .delete(groupStudyParticipants)
      .where(eq(groupStudyParticipants.userId, userId))

    // Hosted rooms restrict user deletion; removing them cascades the
    // remaining room participants, activities, blocks, and join requests.
    if (personalWorkspaceIds.length > 0) {
      await transaction
        .delete(groupStudySessions)
        .where(inArray(groupStudySessions.workspaceId, personalWorkspaceIds))
    }

    await transaction
      .delete(timerSessions)
      .where(eq(timerSessions.userId, userId))

    if (personalWorkspaceIds.length > 0) {
      await transaction
        .delete(reminderDeliveries)
        .where(inArray(reminderDeliveries.workspaceId, personalWorkspaceIds))
    }
    // Notifications pin reminders through a restrict-style composite key, so
    // they must be removed first.
    await transaction
      .delete(inAppNotifications)
      .where(eq(inAppNotifications.userId, userId))
    await transaction.delete(reminders).where(eq(reminders.userId, userId))
    await transaction
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId))

    await transaction
      .delete(attachments)
      .where(eq(attachments.uploadedByUserId, userId))

    // The XP ledger restricts task deletion through its composite quest key,
    // so user-scoped progression records go before workspace content.
    await transaction.delete(xpLedger).where(eq(xpLedger.userId, userId))
    await transaction
      .delete(activityEvents)
      .where(eq(activityEvents.actorUserId, userId))
    await transaction
      .delete(userProgression)
      .where(eq(userProgression.userId, userId))

    if (personalWorkspaceIds.length > 0) {
      await transaction
        .delete(questLabels)
        .where(inArray(questLabels.workspaceId, personalWorkspaceIds))
      await transaction
        .delete(tasks)
        .where(inArray(tasks.workspaceId, personalWorkspaceIds))
      await transaction
        .delete(labels)
        .where(inArray(labels.workspaceId, personalWorkspaceIds))
      await transaction
        .delete(gates)
        .where(inArray(gates.workspaceId, personalWorkspaceIds))
    }

    // Owned workspaces restrict on the owner, so they are removed after all
    // workspace-scoped content; membership and workspace children cascade.
    if (personalWorkspaceIds.length > 0) {
      await transaction
        .delete(workspaces)
        .where(inArray(workspaces.id, personalWorkspaceIds))
    }

    // Sessions, accounts, and user settings cascade from the user row.
    await transaction.delete(users).where(eq(users.id, userId))

    return {
      attachmentKeys: attachmentRows.map((row) => row.storageKey),
      personalWorkspaceIds,
    }
  })
}
