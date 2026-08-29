import "server-only"

import { DateTime } from "luxon"

import { getDatabase, type Database } from "@/db/client"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { localDateForInstant } from "@/features/progression/domain/progression"
import { defaultTimezone } from "@/features/reminders/domain/timezone"
import { isTimerRecordOnLocalDate } from "@/features/timer/domain/daily-study-history"
import type {
  DailyStudySummaryView,
  GroupStudyActivityView,
  GroupStudyHistoryView,
  GroupStudySessionView,
  TimerDashboardView,
  TimerSessionView,
} from "@/features/timer/domain/types"
import {
  findActiveGroupStudyContext,
  findPendingJoinRequestsForRoom,
  listActiveGroupStudyParticipants,
  listGroupStudyActivities,
  listGroupStudyActivitiesForRooms,
  listGroupStudyMembershipHistory,
  listGroupStudyParticipantSummariesForRooms,
} from "@/features/timer/repositories/group-study-repository"
import { groupStudyJoinRequests } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import {
  findActiveTimerSessionRecord,
  listDailyStudySummaryRecords,
  listTodayCompletedTimerSessions,
} from "@/features/timer/repositories/timer-repository"
import type { TimerSessionRecord } from "@/features/timer/repositories/timer-repository"
import { getAuthorizedWorkspaceSummary } from "@/features/workspaces/application/get-workspace-summary"

/** Rooms surfaced in shared history per request. */
const sharedHistoryRoomLimit = 20
/** Latest activity rows kept per room in shared history. */
const sharedHistoryActivityCapPerRoom = 50

type ParticipantSummary = Readonly<{
  joinedAt: Date
  leftAt: Date | null
  name: string
  totalMs: number
  userId: string
}>

function toView(record: TimerSessionRecord): TimerSessionView {
  return {
    accumulatedMs: record.accumulatedMs,
    createdAt: record.createdAt.toISOString(),
    endedAt: record.endedAt?.toISOString() ?? null,
    id: record.id,
    lastStartedAt: record.lastStartedAt?.toISOString() ?? null,
    startedAt: record.startedAt.toISOString(),
    status: record.status,
    subject: record.subject,
    updatedAt: record.updatedAt.toISOString(),
    version: record.version,
  }
}

async function getActiveGroupStudyView(
  database: Database,
  access: AccessContext,
): Promise<GroupStudySessionView | null> {
  const context = await findActiveGroupStudyContext(database, access)
  if (!context) return null
  const { membership, room } = context

  const [participantRecords, activityRecords] = await Promise.all([
    listActiveGroupStudyParticipants(
      database,
      room.workspaceId,
      membership.groupSessionId,
    ),
    listGroupStudyActivities(
      database,
      room.workspaceId,
      membership.groupSessionId,
    ),
  ])

  const isHost = room.hostUserId === access.userId
  const joinRequests = isHost
    ? await findPendingJoinRequestsForRoom(database, room.id)
    : []

  return {
    activities: activityRecords.map((activity) => ({
      action: activity.action,
      id: activity.id,
      name: activity.name,
      occurredAt: activity.occurredAt.toISOString(),
      timerElapsedMs: activity.timerElapsedMs,
      userId: activity.userId,
    })),
    createdAt: room.createdAt.toISOString(),
    id: room.id,
    isHost,
    joinCode: room.joinCode,
    joinLocked: room.joinLocked,
    joinRequests: joinRequests.map((req) => ({
      id: req.id,
      userId: req.userId,
      name: req.name,
      createdAt: req.createdAt.toISOString(),
    })),
    name: room.name,
    participantLimit: room.participantLimit,
    participants: participantRecords.flatMap((participant) =>
      participant.status === "completed"
        ? []
        : [
            {
              accumulatedMs: participant.accumulatedMs,
              id: participant.id,
              isCurrentUser: participant.userId === access.userId,
              isHost: participant.userId === room.hostUserId,
              joinedAt: participant.joinedAt.toISOString(),
              lastStartedAt: participant.lastStartedAt?.toISOString() ?? null,
              name: participant.name,
              status: participant.status,
              subject: participant.subject,
              timerSessionId: participant.timerSessionId,
              userId: participant.userId,
            },
          ],
    ),
    subject: room.subject,
    version: room.version,
  }
}

function toActivityView(
  activity: Awaited<ReturnType<typeof listGroupStudyActivities>>[number],
): GroupStudyActivityView {
  return {
    action: activity.action,
    id: activity.id,
    name: activity.name,
    occurredAt: activity.occurredAt.toISOString(),
    timerElapsedMs: activity.timerElapsedMs,
    userId: activity.userId,
  }
}

async function getGroupStudyHistory(
  database: Database,
  access: AccessContext,
  /** UTC start of the local day; rooms left before this are never loaded. */
  leftAfter: Date,
): Promise<readonly GroupStudyHistoryView[]> {
  // The date filter and room cap are applied in SQL so cost stays flat as
  // membership history grows.
  const memberships = await listGroupStudyMembershipHistory(database, access, {
    leftAfter,
    limit: sharedHistoryRoomLimit * 2,
  })
  const uniqueMemberships = [
    ...new Map(
      memberships.map((membership) => [membership.groupSessionId, membership]),
    ).values(),
  ].slice(0, sharedHistoryRoomLimit)

  if (uniqueMemberships.length === 0) return []

  // Join codes intentionally grant cross-workspace membership, so batch the
  // room reads per room workspace instead of the caller's active workspace;
  // otherwise joiners from another workspace would see empty room details.
  const roomIdsByWorkspace = new Map<string, string[]>()
  for (const membership of uniqueMemberships) {
    const roomIds = roomIdsByWorkspace.get(membership.workspaceId) ?? []
    roomIds.push(membership.groupSessionId)
    roomIdsByWorkspace.set(membership.workspaceId, roomIds)
  }

  const [activityRecords, participantRecords] = await Promise.all([
    Promise.all(
      [...roomIdsByWorkspace].map(([roomWorkspaceId, roomIds]) =>
        listGroupStudyActivitiesForRooms(database, roomWorkspaceId, roomIds),
      ),
    ).then((groups) => groups.flat()),
    Promise.all(
      [...roomIdsByWorkspace].map(([roomWorkspaceId, roomIds]) =>
        listGroupStudyParticipantSummariesForRooms(
          database,
          roomWorkspaceId,
          roomIds,
        ),
      ),
    ).then((groups) => groups.flat()),
  ])

  const activitiesByRoom = new Map<string, typeof activityRecords>()
  for (const activity of activityRecords) {
    const existing = activitiesByRoom.get(activity.groupSessionId)
    // Rows arrive newest-first; keep only the latest slice per room.
    if (existing) {
      if (existing.length < sharedHistoryActivityCapPerRoom) {
        existing.push(activity)
      }
    } else {
      activitiesByRoom.set(activity.groupSessionId, [activity])
    }
  }

  const participantsByRoom = new Map<string, typeof participantRecords>()
  for (const participant of participantRecords) {
    const existing = participantsByRoom.get(participant.groupSessionId)
    if (existing) existing.push(participant)
    else participantsByRoom.set(participant.groupSessionId, [participant])
  }

  return uniqueMemberships.map((membership) => {
    const activityRecordsForRoom =
      activitiesByRoom.get(membership.groupSessionId) ?? []
    const participantRecordsForRoom =
      participantsByRoom.get(membership.groupSessionId) ?? []
    const endedAt = membership.endedAt?.toISOString() ?? null
    const participants = [
      ...participantRecordsForRoom
        .reduce<Map<string, ParticipantSummary>>((summaries, participant) => {
          const existing = summaries.get(participant.userId)
          summaries.set(participant.userId, {
            joinedAt:
              !existing || participant.joinedAt < existing.joinedAt
                ? participant.joinedAt
                : existing.joinedAt,
            leftAt:
              !existing?.leftAt ||
              (participant.leftAt && participant.leftAt > existing.leftAt)
                ? participant.leftAt
                : existing.leftAt,
            name: participant.name,
            totalMs: (existing?.totalMs ?? 0) + participant.totalMs,
            userId: participant.userId,
          })
          return summaries
        }, new Map())
        .values(),
    ]

    return {
      activities: activityRecordsForRoom.map(toActivityView),
      durationMs: membership.endedAt
        ? Math.max(
            0,
            membership.endedAt.getTime() -
              Math.min(
                ...participantRecordsForRoom.map((participant) =>
                  participant.joinedAt.getTime(),
                ),
              ),
          )
        : null,
      endedAt,
      id: membership.groupSessionId,
      joinedAt: membership.joinedAt.toISOString(),
      leftAt:
        membership.leftAt?.toISOString() ?? membership.joinedAt.toISOString(),
      name: membership.name,
      participants: participants.map((participant) => ({
        joinedAt: participant.joinedAt.toISOString(),
        leftAt: participant.leftAt?.toISOString() ?? null,
        name: participant.name,
        totalMs: participant.totalMs,
        userId: participant.userId,
      })),
      subject: membership.subject,
      totalFocusMs: participants.reduce(
        (total, participant) => total + participant.totalMs,
        0,
      ),
    }
  })
}

export async function getTimerDashboard(
  access: AccessContext,
  database: Database = getDatabase(),
  now: Date = new Date(),
): Promise<TimerDashboardView> {
  const activeSessionPromise = findActiveTimerSessionRecord(database, access)
  const sharedSessionPromise = getActiveGroupStudyView(database, access)
  const pendingJoinRequestPromise = database
    .select({
      id: groupStudyJoinRequests.id,
      userId: groupStudyJoinRequests.userId,
      createdAt: groupStudyJoinRequests.createdAt,
    })
    .from(groupStudyJoinRequests)
    .where(
      and(
        eq(groupStudyJoinRequests.userId, access.userId),
        eq(groupStudyJoinRequests.status, "pending"),
      ),
    )
    .limit(1)
    .then((res) => res[0] ?? null)
  const timezone =
    (await getAuthorizedWorkspaceSummary(access, database))?.timezone ??
    defaultTimezone
  const today = localDateForInstant(now, timezone)

  // Compute the UTC boundaries of the current local day so we can push the
  // date filter into SQL instead of loading all sessions.
  const dayStart = DateTime.fromISO(today, { zone: timezone })
    .startOf("day")
    .toUTC()
    .toJSDate()
  const dayEnd = DateTime.fromISO(today, { zone: timezone })
    .endOf("day")
    .toUTC()
    .toJSDate()

  const [
    activeSessionRecord,
    todayRecords,
    sharedHistory,
    sharedSession,
    pendingJoinRequestRecord,
  ] = await Promise.all([
    // Dedicated single-row active lookup instead of loading every session.
    activeSessionPromise,
    listTodayCompletedTimerSessions(database, access, dayStart, dayEnd),
    getGroupStudyHistory(database, access, dayStart),
    sharedSessionPromise,
    pendingJoinRequestPromise,
  ])

  const activeSession = activeSessionRecord ? toView(activeSessionRecord) : null
  const history = todayRecords.map(toView)

  const todaySharedHistory = sharedHistory.filter((membership) =>
    isTimerRecordOnLocalDate(new Date(membership.leftAt), today, timezone),
  )

  return {
    activeSession,
    completedCount: history.length,
    history,
    localDate: today,
    sharedHistory: todaySharedHistory,
    serverNow: now.toISOString(),
    sharedSession,
    pendingJoinRequest: pendingJoinRequestRecord
      ? {
          id: pendingJoinRequestRecord.id,
          userId: pendingJoinRequestRecord.userId,
          name: "",
          createdAt: pendingJoinRequestRecord.createdAt.toISOString(),
        }
      : null,
    timezone,
    totalCompletedMs: history.reduce(
      (total, session) => total + session.accumulatedMs,
      0,
    ),
  }
}

export async function getDailyStudyHistory(
  access: AccessContext,
  timezone: string,
  database: Database = getDatabase(),
): Promise<readonly DailyStudySummaryView[]> {
  // The database returns at most one aggregate per local day instead of
  // transferring an arbitrary number of timer rows to the application.
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  return listDailyStudySummaryRecords(database, access, timezone, since)
}
