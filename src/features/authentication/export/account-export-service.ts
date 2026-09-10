import "server-only"

import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm"

import type { getDatabase } from "@/db/client"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import {
  accounts,
  activityEvents,
  attachments,
  gates,
  groupStudyActivities,
  groupStudyBlocks,
  groupStudyJoinRequests,
  groupStudyParticipants,
  groupStudySessions,
  labels,
  pushSubscriptions,
  questLabels,
  reminders,
  sessions,
  tasks,
  timerSessions,
  userProgression,
  userSettings,
  users,
  workspaceMembers,
  workspaces,
  xpLedger,
} from "@/db/schema"

import {
  accountExportContentNotes,
  accountExportIncludedSections,
  accountExportSecurityExclusions,
} from "./account-export-manifest"

export type AccountExportPayload = Readonly<Record<string, unknown>>

type Database = ReturnType<typeof getDatabase>

type AccountExportOptions = Readonly<{
  browserPreferenceConsent?: Readonly<{
    personalization: boolean
    preferences: boolean
  }> | null
  currentSessionId?: string | null
}>

const EXPORT_LIMITS = {
  activityEvents: 1_000,
  attachments: 2_000,
  focusSessions: 2_000,
  sharedGroupActivity: 2_000,
  tasks: 5_000,
  xpLedger: 2_000,
} as const

export async function buildAccountExport(
  database: Database,
  access: AccessContext,
  options: AccountExportOptions = {},
): Promise<AccountExportPayload> {
  const userId = access.userId
  const exportedAt = new Date()

  const participationPromise = database
    .select({
      createdAt: groupStudyParticipants.createdAt,
      groupSessionId: groupStudyParticipants.groupSessionId,
      joinedAt: groupStudyParticipants.joinedAt,
      leftAt: groupStudyParticipants.leftAt,
      timerSessionId: groupStudyParticipants.timerSessionId,
      updatedAt: groupStudyParticipants.updatedAt,
    })
    .from(groupStudyParticipants)
    .where(eq(groupStudyParticipants.userId, userId))
    .orderBy(desc(groupStudyParticipants.joinedAt))

  const [
    accountRows,
    settingsRows,
    workspaceRows,
    sessionRows,
    taskRows,
    gateRows,
    labelRows,
    taskLabelRows,
    reminderRows,
    focusSessionRows,
    progressionRows,
    xpRows,
    activityRows,
    attachmentRows,
    pushDeviceRows,
    sharedActivityRows,
    sharedJoinRequestRows,
    sharedBlockRows,
    providerRows,
    participationRows,
  ] = await Promise.all([
    database
      .select({
        ageConfirmedAt: users.ageConfirmedAt,
        ageRequirementVersion: users.ageRequirementVersion,
        createdAt: users.createdAt,
        email: users.email,
        emailVerified: users.emailVerified,
        id: users.id,
        image: users.image,
        name: users.name,
        privacyNoticeAcknowledgedAt: users.privacyNoticeAcknowledgedAt,
        privacyNoticeVersion: users.privacyNoticeVersion,
        termsAcceptedAt: users.termsAcceptedAt,
        termsVersion: users.termsVersion,
        twoFactorEnabled: users.twoFactorEnabled,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    database
      .select({
        createdAt: userSettings.createdAt,
        emailRemindersEnabled: userSettings.emailRemindersEnabled,
        onboardingCompletedAt: userSettings.onboardingCompletedAt,
        timezone: userSettings.timezone,
        timezoneConfirmedAt: userSettings.timezoneConfirmedAt,
        todayPromoShownOn: userSettings.todayPromoShownOn,
        updatedAt: userSettings.updatedAt,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1),
    database
      .select({
        createdAt: workspaces.createdAt,
        deletedAt: workspaces.deletedAt,
        id: workspaces.id,
        joinedAt: workspaceMembers.joinedAt,
        kind: workspaces.kind,
        membershipDeletedAt: workspaceMembers.deletedAt,
        name: workspaces.name,
        ownerUserId: workspaces.ownerUserId,
        role: workspaceMembers.role,
        slug: workspaces.slug,
        timezone: workspaces.timezone,
        updatedAt: workspaces.updatedAt,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, userId))
      .orderBy(asc(workspaces.createdAt)),
    database
      .select({
        createdAt: sessions.createdAt,
        expiresAt: sessions.expiresAt,
        id: sessions.id,
        ipAddress: sessions.ipAddress,
        updatedAt: sessions.updatedAt,
        userAgent: sessions.userAgent,
      })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.updatedAt)),
    database
      .select({
        completedAt: tasks.completedAt,
        createdAt: tasks.createdAt,
        customType: tasks.customType,
        deletedAt: tasks.deletedAt,
        description: tasks.description,
        dueAt: tasks.dueAt,
        effort: tasks.effort,
        effortManual: tasks.effortManual,
        id: tasks.id,
        parentTaskId: tasks.parentTaskId,
        position: tasks.position,
        priority: tasks.priority,
        projectId: tasks.projectId,
        recurrenceOccurrenceAt: tasks.recurrenceOccurrenceAt,
        recurrenceRule: tasks.recurrenceRule,
        recurrenceSequence: tasks.recurrenceSequence,
        recurrenceSeriesId: tasks.recurrenceSeriesId,
        recurrenceTimezone: tasks.recurrenceTimezone,
        startAt: tasks.startAt,
        status: tasks.status,
        taskType: tasks.taskType,
        title: tasks.title,
        typeManual: tasks.typeManual,
        updatedAt: tasks.updatedAt,
        workspaceId: tasks.workspaceId,
        xpReward: tasks.xpReward,
      })
      .from(tasks)
      .where(and(eq(tasks.createdByUserId, userId), isNull(tasks.purgedAt)))
      .orderBy(desc(tasks.createdAt))
      .limit(EXPORT_LIMITS.tasks),
    database
      .select({
        accentToken: gates.accentToken,
        archivedAt: gates.archivedAt,
        createdAt: gates.createdAt,
        deletedAt: gates.deletedAt,
        description: gates.description,
        id: gates.id,
        name: gates.name,
        position: gates.position,
        updatedAt: gates.updatedAt,
        workspaceId: gates.workspaceId,
      })
      .from(gates)
      .where(eq(gates.createdByUserId, userId))
      .orderBy(desc(gates.createdAt)),
    database
      .select({
        colorToken: labels.colorToken,
        createdAt: labels.createdAt,
        deletedAt: labels.deletedAt,
        id: labels.id,
        name: labels.name,
        updatedAt: labels.updatedAt,
        workspaceId: labels.workspaceId,
      })
      .from(labels)
      .where(eq(labels.createdByUserId, userId))
      .orderBy(asc(labels.name)),
    database
      .select({
        createdAt: questLabels.createdAt,
        labelId: questLabels.labelId,
        taskId: questLabels.questId,
        workspaceId: questLabels.workspaceId,
      })
      .from(questLabels)
      .innerJoin(tasks, eq(questLabels.questId, tasks.id))
      .where(eq(tasks.createdByUserId, userId))
      .orderBy(desc(questLabels.createdAt)),
    database
      .select({
        attemptCount: reminders.attemptCount,
        channel: reminders.channel,
        createdAt: reminders.createdAt,
        deliveredAt: reminders.deliveredAt,
        id: reminders.id,
        lastErrorCode: reminders.lastErrorCode,
        remindAt: reminders.remindAt,
        status: reminders.status,
        taskId: reminders.questId,
        timezone: reminders.timezone,
        updatedAt: reminders.updatedAt,
        workspaceId: reminders.workspaceId,
      })
      .from(reminders)
      .where(eq(reminders.userId, userId))
      .orderBy(desc(reminders.createdAt)),
    database
      .select({
        accumulatedMs: timerSessions.accumulatedMs,
        createdAt: timerSessions.createdAt,
        endedAt: timerSessions.endedAt,
        id: timerSessions.id,
        lastStartedAt: timerSessions.lastStartedAt,
        startedAt: timerSessions.startedAt,
        status: timerSessions.status,
        subject: timerSessions.subject,
        updatedAt: timerSessions.updatedAt,
        workspaceId: timerSessions.workspaceId,
      })
      .from(timerSessions)
      .where(eq(timerSessions.userId, userId))
      .orderBy(desc(timerSessions.startedAt))
      .limit(EXPORT_LIMITS.focusSessions),
    database
      .select({
        bestStreak: userProgression.bestStreak,
        createdAt: userProgression.createdAt,
        currentStreak: userProgression.currentStreak,
        experiencePoints: userProgression.experiencePoints,
        hunterLevel: userProgression.hunterLevel,
        hunterRank: userProgression.hunterRank,
        lastClearedLocalDate: userProgression.lastClearedLocalDate,
        updatedAt: userProgression.updatedAt,
        workspaceId: userProgression.workspaceId,
      })
      .from(userProgression)
      .where(eq(userProgression.userId, userId))
      .orderBy(asc(userProgression.createdAt)),
    database
      .select({
        createdAt: xpLedger.createdAt,
        earnedForLocalDate: xpLedger.earnedForLocalDate,
        id: xpLedger.id,
        questId: xpLedger.questId,
        reason: xpLedger.reason,
        reversesLedgerEntryId: xpLedger.reversesLedgerEntryId,
        workspaceId: xpLedger.workspaceId,
        xpDelta: xpLedger.xpDelta,
      })
      .from(xpLedger)
      .where(eq(xpLedger.userId, userId))
      .orderBy(desc(xpLedger.createdAt))
      .limit(EXPORT_LIMITS.xpLedger),
    database
      .select({
        createdAt: activityEvents.createdAt,
        eventType: activityEvents.eventType,
        id: activityEvents.id,
        occurredAt: activityEvents.occurredAt,
        payload: activityEvents.payload,
        subjectId: activityEvents.subjectId,
        subjectType: activityEvents.subjectType,
        workspaceId: activityEvents.workspaceId,
      })
      .from(activityEvents)
      .where(eq(activityEvents.actorUserId, userId))
      .orderBy(desc(activityEvents.occurredAt))
      .limit(EXPORT_LIMITS.activityEvents),
    database
      .select({
        byteSize: attachments.byteSize,
        contentType: attachments.contentType,
        createdAt: attachments.createdAt,
        deletedAt: attachments.deletedAt,
        displayName: attachments.displayName,
        expectedByteSize: attachments.expectedByteSize,
        id: attachments.id,
        questId: attachments.questId,
        readyAt: attachments.readyAt,
        status: attachments.status,
        updatedAt: attachments.updatedAt,
        workspaceId: attachments.workspaceId,
      })
      .from(attachments)
      .where(eq(attachments.uploadedByUserId, userId))
      .orderBy(desc(attachments.createdAt))
      .limit(EXPORT_LIMITS.attachments),
    database
      .select({
        createdAt: pushSubscriptions.createdAt,
        id: pushSubscriptions.id,
        updatedAt: pushSubscriptions.updatedAt,
      })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId))
      .orderBy(desc(pushSubscriptions.updatedAt)),
    database
      .select({
        action: groupStudyActivities.action,
        groupSessionId: groupStudyActivities.groupSessionId,
        occurredAt: groupStudyActivities.occurredAt,
        timerElapsedMs: groupStudyActivities.timerElapsedMs,
      })
      .from(groupStudyActivities)
      .where(eq(groupStudyActivities.userId, userId))
      .orderBy(desc(groupStudyActivities.occurredAt))
      .limit(EXPORT_LIMITS.sharedGroupActivity),
    database
      .select({
        createdAt: groupStudyJoinRequests.createdAt,
        groupSessionId: groupStudyJoinRequests.groupSessionId,
        id: groupStudyJoinRequests.id,
        status: groupStudyJoinRequests.status,
        updatedAt: groupStudyJoinRequests.updatedAt,
      })
      .from(groupStudyJoinRequests)
      .where(eq(groupStudyJoinRequests.userId, userId))
      .orderBy(desc(groupStudyJoinRequests.createdAt)),
    database
      .select({
        blockedAt: groupStudyBlocks.blockedAt,
        groupSessionId: groupStudyBlocks.groupSessionId,
      })
      .from(groupStudyBlocks)
      .where(eq(groupStudyBlocks.userId, userId))
      .orderBy(desc(groupStudyBlocks.blockedAt)),
    database
      .select({
        accountId: accounts.accountId,
        createdAt: accounts.createdAt,
        providerId: accounts.providerId,
        updatedAt: accounts.updatedAt,
      })
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .orderBy(asc(accounts.createdAt)),
    participationPromise,
  ])

  const participatedGroupIds = Array.from(
    new Set(participationRows.map((row) => row.groupSessionId)),
  )
  const sharedGroupCondition =
    participatedGroupIds.length > 0
      ? or(
          eq(groupStudySessions.hostUserId, userId),
          inArray(groupStudySessions.id, participatedGroupIds),
        )
      : eq(groupStudySessions.hostUserId, userId)
  const sharedGroupRows = await database
    .select({
      createdAt: groupStudySessions.createdAt,
      endedAt: groupStudySessions.endedAt,
      expiresAt: groupStudySessions.expiresAt,
      hostUserId: groupStudySessions.hostUserId,
      id: groupStudySessions.id,
      joinLocked: groupStudySessions.joinLocked,
      name: groupStudySessions.name,
      participantLimit: groupStudySessions.participantLimit,
      status: groupStudySessions.status,
      subject: groupStudySessions.subject,
      updatedAt: groupStudySessions.updatedAt,
      workspaceId: groupStudySessions.workspaceId,
    })
    .from(groupStudySessions)
    .where(sharedGroupCondition)
    .orderBy(desc(groupStudySessions.createdAt))

  const account = accountRows[0] ?? null
  const settings = settingsRows[0] ?? null
  const consentHistory: Array<Record<string, unknown>> = []
  if (account?.termsAcceptedAt) {
    consentHistory.push({
      action: "accepted",
      occurredAt: account.termsAcceptedAt,
      type: "terms_of_service",
      version: account.termsVersion,
    })
  }
  if (account?.privacyNoticeAcknowledgedAt) {
    consentHistory.push({
      action: "acknowledged",
      occurredAt: account.privacyNoticeAcknowledgedAt,
      type: "privacy_notice",
      version: account.privacyNoticeVersion,
    })
  }
  if (account?.ageConfirmedAt) {
    consentHistory.push({
      action: "confirmed",
      occurredAt: account.ageConfirmedAt,
      type: "age_requirement",
      version: account.ageRequirementVersion,
    })
  }
  if (settings) {
    consentHistory.push({
      action: settings.emailRemindersEnabled ? "enabled" : "withdrawn",
      current: true,
      occurredAt: settings.updatedAt,
      type: "email_reminders",
    })
  }
  consentHistory.push({
    action: pushDeviceRows.length > 0 ? "enabled" : "not_granted",
    current: true,
    deviceCount: pushDeviceRows.length,
    occurredAt: pushDeviceRows[0]?.updatedAt ?? null,
    type: "web_push_notifications",
  })
  if (options.browserPreferenceConsent) {
    consentHistory.push({
      action: options.browserPreferenceConsent.preferences
        ? "enabled"
        : "withdrawn",
      current: true,
      note: "Current browser snapshot; earlier changes are not retained on the server.",
      occurredAt: null,
      personalization: options.browserPreferenceConsent.personalization,
      recordedAt: exportedAt,
      type: "browser_preferences",
    })
  }

  return {
    exportMetadata: {
      activeWorkspaceId: access.workspaceId,
      contentNotes: accountExportContentNotes,
      exportedAt,
      formatVersion: 2,
      includedSections: accountExportIncludedSections,
      limits: EXPORT_LIMITS,
      scope:
        "Account-wide records owned by this account, plus membership and sharing metadata visible to it.",
    },
    account: account
      ? { ...account, connectedSignInMethods: providerRows }
      : null,
    settings,
    consentHistory,
    sessions: sessionRows.map((row) => ({
      ...row,
      isCurrent: row.id === options.currentSessionId,
    })),
    workspaces: workspaceRows.map(({ ownerUserId, ...row }) => ({
      ...row,
      ownedByAccount: ownerUserId === userId,
    })),
    tasks: taskRows,
    gates: gateRows,
    labels: labelRows,
    taskLabels: taskLabelRows,
    reminders: reminderRows,
    focusSessions: focusSessionRows,
    progression: progressionRows,
    xpLedger: xpRows,
    activityEvents: activityRows,
    attachments: attachmentRows,
    sharedGroups: sharedGroupRows.map(({ hostUserId, ...row }) => ({
      ...row,
      hostedByAccount: hostUserId === userId,
      joinCodeIncluded: false,
    })),
    sharedGroupParticipations: participationRows,
    sharedGroupActivity: sharedActivityRows,
    sharingInformation: {
      sharedGroupBlocks: sharedBlockRows,
      sharedGroupJoinRequests: sharedJoinRequestRows,
      workspaceMemberships: workspaceRows.map((row) => ({
        joinedAt: row.joinedAt,
        membershipDeletedAt: row.membershipDeletedAt,
        role: row.role,
        workspaceId: row.id,
        workspaceKind: row.kind,
        workspaceName: row.name,
      })),
    },
    securityExclusions: accountExportSecurityExclusions,
  }
}
