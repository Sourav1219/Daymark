import "server-only"

import { asc, desc, eq } from "drizzle-orm"

import type { DatabaseExecutor } from "@/db/client"
import {
  activityEvents,
  attachments,
  gates,
  groupStudyParticipants,
  labels,
  questLabels,
  reminders,
  tasks,
  timerSessions,
  userProgression,
  workspaces,
  xpLedger,
} from "@/db/schema"
import type { AccessContext } from "@/features/authentication/authorization/access-context"

/** Row caps keep export generation bounded for very large accounts. */
const taskExportLimit = 5_000
const eventExportLimit = 1_000
const sessionExportLimit = 2_000

export type AccountExportPayload = Readonly<Record<string, unknown>>

/**
 * Assembles a portable JSON snapshot of everything the workspace owns. Reads
 * are bounded and scoped by the same AccessContext predicates the application
 * uses everywhere else; nothing outside the boundary is reachable.
 */
export async function buildAccountExport(
  database: DatabaseExecutor,
  access: AccessContext,
  profile: Readonly<{ email: string; name: string }>,
): Promise<AccountExportPayload> {
  const [workspace] = await database
    .select({
      createdAt: workspaces.createdAt,
      name: workspaces.name,
      timezone: workspaces.timezone,
    })
    .from(workspaces)
    .where(eq(workspaces.id, access.workspaceId))
    .limit(1)

  const taskRows = await database
    .select({
      completedAt: tasks.completedAt,
      createdAt: tasks.createdAt,
      deletedAt: tasks.deletedAt,
      description: tasks.description,
      dueAt: tasks.dueAt,
      id: tasks.id,
      parentTaskId: tasks.parentTaskId,
      priority: tasks.priority,
      projectId: tasks.projectId,
      recurrenceRule: tasks.recurrenceRule,
      startAt: tasks.startAt,
      status: tasks.status,
      title: tasks.title,
      updatedAt: tasks.updatedAt,
      xpReward: tasks.xpReward,
    })
    .from(tasks)
    .where(eq(tasks.workspaceId, access.workspaceId))
    .orderBy(asc(tasks.position), asc(tasks.createdAt))
    .limit(taskExportLimit)

  const labelRows = await database
    .select({
      colorToken: labels.colorToken,
      createdAt: labels.createdAt,
      id: labels.id,
      name: labels.name,
    })
    .from(labels)
    .where(eq(labels.workspaceId, access.workspaceId))
    .orderBy(asc(labels.createdAt))

  const gateRows = await database
    .select({
      archivedAt: gates.archivedAt,
      createdAt: gates.createdAt,
      id: gates.id,
      name: gates.name,
    })
    .from(gates)
    .where(eq(gates.workspaceId, access.workspaceId))
    .orderBy(asc(gates.createdAt))

  const questLabelRows = await database
    .select({
      labelId: questLabels.labelId,
      taskId: questLabels.questId,
    })
    .from(questLabels)
    .where(eq(questLabels.workspaceId, access.workspaceId))

  const reminderRows = await database
    .select({
      channel: reminders.channel,
      createdAt: reminders.createdAt,
      remindAt: reminders.remindAt,
      status: reminders.status,
      taskId: reminders.questId,
      timezone: reminders.timezone,
    })
    .from(reminders)
    .where(eq(reminders.workspaceId, access.workspaceId))
    .orderBy(desc(reminders.createdAt))
    .limit(taskExportLimit)

  const timerRows = await database
    .select({
      accumulatedMs: timerSessions.accumulatedMs,
      endedAt: timerSessions.endedAt,
      startedAt: timerSessions.startedAt,
      status: timerSessions.status,
      subject: timerSessions.subject,
    })
    .from(timerSessions)
    .where(eq(timerSessions.workspaceId, access.workspaceId))
    .orderBy(desc(timerSessions.startedAt))
    .limit(sessionExportLimit)

  const [progression] = await database
    .select({
      bestStreak: userProgression.bestStreak,
      currentStreak: userProgression.currentStreak,
      experiencePoints: userProgression.experiencePoints,
      hunterLevel: userProgression.hunterLevel,
      hunterRank: userProgression.hunterRank,
      updatedAt: userProgression.updatedAt,
    })
    .from(userProgression)
    .where(eq(userProgression.userId, access.userId))
    .limit(1)

  const ledgerRows = await database
    .select({
      createdAt: xpLedger.createdAt,
      earnedForLocalDate: xpLedger.earnedForLocalDate,
      reason: xpLedger.reason,
      xpDelta: xpLedger.xpDelta,
    })
    .from(xpLedger)
    .where(eq(xpLedger.userId, access.userId))
    .orderBy(desc(xpLedger.createdAt))
    .limit(eventExportLimit)

  const activityRows = await database
    .select({
      eventType: activityEvents.eventType,
      occurredAt: activityEvents.occurredAt,
      subjectId: activityEvents.subjectId,
    })
    .from(activityEvents)
    .where(eq(activityEvents.workspaceId, access.workspaceId))
    .orderBy(desc(activityEvents.occurredAt))
    .limit(eventExportLimit)

  const attachmentRows = await database
    .select({
      byteSize: attachments.byteSize,
      contentType: attachments.contentType,
      displayName: attachments.displayName,
      status: attachments.status,
      taskId: attachments.questId,
    })
    .from(attachments)
    .where(eq(attachments.workspaceId, access.workspaceId))
    .orderBy(desc(attachments.createdAt))
    .limit(taskExportLimit)

  const participationRows = await database
    .select({
      joinedAt: groupStudyParticipants.joinedAt,
      leftAt: groupStudyParticipants.leftAt,
    })
    .from(groupStudyParticipants)
    .where(eq(groupStudyParticipants.userId, access.userId))
    .orderBy(desc(groupStudyParticipants.joinedAt))
    .limit(sessionExportLimit)

  return {
    account: {
      email: profile.email,
      exportedAt: new Date().toISOString(),
      name: profile.name,
      userId: access.userId,
    },
    activityEvents: activityRows,
    attachments: attachmentRows,
    exports: {
      activityEventLimit: eventExportLimit,
      taskLimit: taskExportLimit,
      timerSessionLimit: sessionExportLimit,
    },
    gates: gateRows,
    labels: labelRows,
    progression: progression ?? null,
    reminders: reminderRows,
    taskLabels: questLabelRows,
    tasks: taskRows,
    timerSessions: timerRows,
    workspace: workspace ?? null,
    groupStudyParticipations: participationRows,
    xpLedger: ledgerRows,
  }
}
