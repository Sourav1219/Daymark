import "server-only"

import {
  and,
  count,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNotNull,
  isNull,
  ne,
  sql,
} from "drizzle-orm"

import type { DatabaseExecutor } from "@/db/client"
import {
  groupStudyActivities,
  groupStudyBlocks,
  groupStudyJoinRequests,
  groupStudyParticipants,
  groupStudySessions,
  timerSessions,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema"
import type { GroupStudyActivityAction } from "@/features/timer/domain/types"
import type { AccessContext } from "@/features/authentication/authorization/access-context"

const sessionSelection = {
  createdAt: groupStudySessions.createdAt,
  endedAt: groupStudySessions.endedAt,
  expiresAt: groupStudySessions.expiresAt,
  hostUserId: groupStudySessions.hostUserId,
  id: groupStudySessions.id,
  joinCode: groupStudySessions.joinCode,
  joinLocked: groupStudySessions.joinLocked,
  name: groupStudySessions.name,
  participantLimit: groupStudySessions.participantLimit,
  status: groupStudySessions.status,
  subject: groupStudySessions.subject,
  version: groupStudySessions.version,
  workspaceId: groupStudySessions.workspaceId,
}

const participantSelection = {
  groupSessionId: groupStudyParticipants.groupSessionId,
  id: groupStudyParticipants.id,
  joinedAt: groupStudyParticipants.joinedAt,
  leftAt: groupStudyParticipants.leftAt,
  timerSessionId: groupStudyParticipants.timerSessionId,
  userId: groupStudyParticipants.userId,
  version: groupStudyParticipants.version,
}

function activeAccessPredicate(
  database: DatabaseExecutor,
  access: AccessContext,
) {
  return exists(
    database
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(
        and(
          eq(workspaceMembers.userId, access.userId),
          eq(workspaceMembers.workspaceId, access.workspaceId),
          isNull(workspaceMembers.deletedAt),
          isNull(workspaces.deletedAt),
        ),
      ),
  )
}

function participantAccessPredicate(
  database: DatabaseExecutor,
  access: AccessContext,
  groupSessionId: string,
  activeOnly = true,
) {
  return exists(
    database
      .select({ id: groupStudyParticipants.id })
      .from(groupStudyParticipants)
      .innerJoin(
        timerSessions,
        eq(timerSessions.id, groupStudyParticipants.timerSessionId),
      )
      .where(
        and(
          eq(groupStudyParticipants.groupSessionId, groupSessionId),
          eq(groupStudyParticipants.userId, access.userId),
          eq(timerSessions.workspaceId, access.workspaceId),
          activeOnly ? isNull(groupStudyParticipants.leftAt) : undefined,
          activeAccessPredicate(database, access),
        ),
      ),
  )
}

export async function findGroupStudySessionByCode(
  database: DatabaseExecutor,
  access: AccessContext,
  joinCode: string,
) {
  const [record] = await database
    .select(sessionSelection)
    .from(groupStudySessions)
    .where(
      and(
        eq(groupStudySessions.joinCode, joinCode),
        eq(groupStudySessions.status, "active"),
        activeAccessPredicate(database, access),
      ),
    )
    .limit(1)

  return record ?? null
}

export async function groupStudyJoinCodeExists(
  database: DatabaseExecutor,
  joinCode: string,
) {
  const [record] = await database
    .select({ id: groupStudySessions.id })
    .from(groupStudySessions)
    .where(eq(groupStudySessions.joinCode, joinCode))
    .limit(1)

  return Boolean(record)
}

/**
 * Resolves the workspaceId that owns a given group study room.
 * Does NOT enforce any access predicate — callers must subsequently
 * verify membership via requireWorkspaceAccess(workspaceId).
 */
export async function findGroupStudySessionWorkspaceId(
  database: DatabaseExecutor,
  roomId: string,
): Promise<string | null> {
  const [record] = await database
    .select({ workspaceId: groupStudySessions.workspaceId })
    .from(groupStudySessions)
    .where(
      and(
        eq(groupStudySessions.id, roomId),
        eq(groupStudySessions.status, "active"),
      ),
    )
    .limit(1)

  return record?.workspaceId ?? null
}

export async function findGroupStudySessionRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  groupSessionId: string,
  activeMembershipOnly = true,
) {
  const [record] = await database
    .select(sessionSelection)
    .from(groupStudySessions)
    .where(
      and(
        eq(groupStudySessions.id, groupSessionId),
        participantAccessPredicate(
          database,
          access,
          groupSessionId,
          activeMembershipOnly,
        ),
      ),
    )
    .limit(1)

  return record ?? null
}

/** Minimal room snapshot used by client version polling in one database read. */
export async function findGroupStudyPollSnapshot(
  database: DatabaseExecutor,
  access: AccessContext,
  groupSessionId: string,
) {
  const [record] = await database
    .select({
      participantCount: sql<number>`(
        select count(*)::integer
        from ${groupStudyParticipants}
        where ${groupStudyParticipants.groupSessionId} = ${groupStudySessions.id}
          and ${groupStudyParticipants.leftAt} is null
      )`,
      status: groupStudySessions.status,
      version: groupStudySessions.version,
    })
    .from(groupStudySessions)
    .where(
      and(
        eq(groupStudySessions.id, groupSessionId),
        participantAccessPredicate(database, access, groupSessionId),
      ),
    )
    .limit(1)

  return record ?? null
}

export async function findActiveGroupStudyParticipant(
  database: DatabaseExecutor,
  access: AccessContext,
) {
  const [record] = await database
    .select(participantSelection)
    .from(groupStudyParticipants)
    .innerJoin(
      groupStudySessions,
      eq(groupStudySessions.id, groupStudyParticipants.groupSessionId),
    )
    .innerJoin(
      timerSessions,
      eq(timerSessions.id, groupStudyParticipants.timerSessionId),
    )
    .where(
      and(
        eq(groupStudyParticipants.userId, access.userId),
        eq(timerSessions.workspaceId, access.workspaceId),
        isNull(groupStudyParticipants.leftAt),
        eq(groupStudySessions.status, "active"),
        activeAccessPredicate(database, access),
      ),
    )
    .limit(1)

  return record ?? null
}

export async function findActiveGroupStudyParticipantForTimer(
  database: DatabaseExecutor,
  access: AccessContext,
  timerSessionId: string,
) {
  const [record] = await database
    .select(participantSelection)
    .from(groupStudyParticipants)
    .innerJoin(
      groupStudySessions,
      eq(groupStudySessions.id, groupStudyParticipants.groupSessionId),
    )
    .innerJoin(
      timerSessions,
      eq(timerSessions.id, groupStudyParticipants.timerSessionId),
    )
    .where(
      and(
        eq(groupStudyParticipants.userId, access.userId),
        eq(timerSessions.workspaceId, access.workspaceId),
        eq(groupStudyParticipants.timerSessionId, timerSessionId),
        isNull(groupStudyParticipants.leftAt),
        eq(groupStudySessions.status, "active"),
        activeAccessPredicate(database, access),
      ),
    )
    .limit(1)

  return record ?? null
}

export async function createGroupStudySessionRecord(
  database: DatabaseExecutor,
  input: Readonly<{
    expiresAt?: Date | null
    hostUserId: string
    joinCode: string
    name: string
    now: Date
    participantLimit: number
    subject: string
    workspaceId: string
  }>,
) {
  const [record] = await database
    .insert(groupStudySessions)
    .values({
      createdAt: input.now,
      expiresAt: input.expiresAt,
      hostUserId: input.hostUserId,
      joinCode: input.joinCode,
      name: input.name,
      participantLimit: input.participantLimit,
      subject: input.subject,
      updatedAt: input.now,
      workspaceId: input.workspaceId,
    })
    .returning(sessionSelection)

  return record ?? null
}

export async function updateGroupStudySessionRecord(
  database: DatabaseExecutor,
  input: Readonly<{
    expectedVersion: number
    groupSessionId: string
    joinCode?: string
    joinLocked?: boolean
    name?: string
    now: Date
    participantLimit?: number
    subject?: string
    workspaceId: string
  }>,
) {
  const [record] = await database
    .update(groupStudySessions)
    .set({
      ...(input.joinCode === undefined ? {} : { joinCode: input.joinCode }),
      ...(input.joinLocked === undefined
        ? {}
        : { joinLocked: input.joinLocked }),
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.participantLimit === undefined
        ? {}
        : { participantLimit: input.participantLimit }),
      ...(input.subject === undefined ? {} : { subject: input.subject }),
      updatedAt: input.now,
      version: input.expectedVersion + 1,
    })
    .where(
      and(
        eq(groupStudySessions.id, input.groupSessionId),
        eq(groupStudySessions.workspaceId, input.workspaceId),
        eq(groupStudySessions.status, "active"),
        eq(groupStudySessions.version, input.expectedVersion),
      ),
    )
    .returning(sessionSelection)

  return record ?? null
}

export async function createGroupStudyParticipantRecord(
  database: DatabaseExecutor,
  input: Readonly<{
    groupSessionId: string
    now: Date
    timerSessionId: string
    userId: string
  }>,
) {
  const [record] = await database
    .insert(groupStudyParticipants)
    .values({
      createdAt: input.now,
      groupSessionId: input.groupSessionId,
      joinedAt: input.now,
      timerSessionId: input.timerSessionId,
      updatedAt: input.now,
      userId: input.userId,
    })
    .returning(participantSelection)

  return record ?? null
}

export async function createGroupStudyActivityRecord(
  database: DatabaseExecutor,
  input: Readonly<{
    action: GroupStudyActivityAction
    groupSessionId: string
    now: Date
    participantId: string
    timerElapsedMs: number
    userId: string
  }>,
) {
  await database.insert(groupStudyActivities).values({
    action: input.action,
    groupSessionId: input.groupSessionId,
    occurredAt: input.now,
    participantId: input.participantId,
    timerElapsedMs: input.timerElapsedMs,
    userId: input.userId,
  })
}

export async function lockGroupStudySessionRecord(
  database: DatabaseExecutor,
  workspaceId: string,
  groupSessionId: string,
) {
  const [record] = await database
    .select(sessionSelection)
    .from(groupStudySessions)
    .where(
      and(
        eq(groupStudySessions.id, groupSessionId),
        eq(groupStudySessions.workspaceId, workspaceId),
      ),
    )
    .for("update")
    .limit(1)

  return record ?? null
}

export async function markGroupStudyParticipantLeft(
  database: DatabaseExecutor,
  input: Readonly<{
    now: Date
    participantId: string
    userId: string
    workspaceId: string
  }>,
) {
  const [record] = await database
    .update(groupStudyParticipants)
    .set({
      leftAt: input.now,
      updatedAt: input.now,
      version: sql`${groupStudyParticipants.version} + 1`,
    })
    .where(
      and(
        eq(groupStudyParticipants.id, input.participantId),
        eq(groupStudyParticipants.userId, input.userId),
        isNull(groupStudyParticipants.leftAt),
        exists(
          database
            .select({ id: groupStudySessions.id })
            .from(groupStudySessions)
            .where(
              and(
                eq(
                  groupStudySessions.id,
                  groupStudyParticipants.groupSessionId,
                ),
                eq(groupStudySessions.workspaceId, input.workspaceId),
              ),
            ),
        ),
      ),
    )
    .returning(participantSelection)

  return record ?? null
}

export async function countActiveGroupStudyParticipants(
  database: DatabaseExecutor,
  workspaceId: string,
  groupSessionId: string,
) {
  const [result] = await database
    .select({ value: count() })
    .from(groupStudyParticipants)
    .innerJoin(
      groupStudySessions,
      eq(groupStudySessions.id, groupStudyParticipants.groupSessionId),
    )
    .where(
      and(
        eq(groupStudyParticipants.groupSessionId, groupSessionId),
        eq(groupStudySessions.workspaceId, workspaceId),
        isNull(groupStudyParticipants.leftAt),
      ),
    )

  return result?.value ?? 0
}

export async function findGroupStudyBlock(
  database: DatabaseExecutor,
  workspaceId: string,
  groupSessionId: string,
  userId: string,
) {
  const [record] = await database
    .select({ userId: groupStudyBlocks.userId })
    .from(groupStudyBlocks)
    .innerJoin(
      groupStudySessions,
      eq(groupStudySessions.id, groupStudyBlocks.groupSessionId),
    )
    .where(
      and(
        eq(groupStudyBlocks.groupSessionId, groupSessionId),
        eq(groupStudyBlocks.userId, userId),
        eq(groupStudySessions.workspaceId, workspaceId),
      ),
    )
    .limit(1)

  return record ?? null
}

export async function createGroupStudyBlockRecord(
  database: DatabaseExecutor,
  input: Readonly<{
    blockedByUserId: string
    groupSessionId: string
    now: Date
    userId: string
  }>,
) {
  await database
    .insert(groupStudyBlocks)
    .values({
      blockedAt: input.now,
      blockedByUserId: input.blockedByUserId,
      groupSessionId: input.groupSessionId,
      userId: input.userId,
    })
    .onConflictDoNothing()
}

export async function lockActiveGroupStudyParticipantForModeration(
  database: DatabaseExecutor,
  workspaceId: string,
  groupSessionId: string,
  participantId: string,
) {
  const [record] = await database
    .select({
      accumulatedMs: timerSessions.accumulatedMs,
      groupSessionId: groupStudyParticipants.groupSessionId,
      id: groupStudyParticipants.id,
      lastStartedAt: timerSessions.lastStartedAt,
      status: timerSessions.status,
      timerSessionId: timerSessions.id,
      timerVersion: timerSessions.version,
      timerWorkspaceId: timerSessions.workspaceId,
      userId: groupStudyParticipants.userId,
    })
    .from(groupStudyParticipants)
    .innerJoin(
      timerSessions,
      eq(timerSessions.id, groupStudyParticipants.timerSessionId),
    )
    .innerJoin(
      groupStudySessions,
      eq(groupStudySessions.id, groupStudyParticipants.groupSessionId),
    )
    .where(
      and(
        eq(groupStudyParticipants.id, participantId),
        eq(groupStudyParticipants.groupSessionId, groupSessionId),
        eq(groupStudySessions.workspaceId, workspaceId),
        isNull(groupStudyParticipants.leftAt),
        ne(timerSessions.status, "completed"),
      ),
    )
    .for("update")
    .limit(1)

  return record ?? null
}

export async function completeGroupStudyParticipantTimer(
  database: DatabaseExecutor,
  input: Readonly<{
    accumulatedMs: number
    expectedVersion: number
    now: Date
    timerSessionId: string
    userId: string
    workspaceId: string
  }>,
) {
  const [record] = await database
    .update(timerSessions)
    .set({
      accumulatedMs: input.accumulatedMs,
      endedAt: input.now,
      lastStartedAt: null,
      status: "completed",
      updatedAt: input.now,
      version: input.expectedVersion + 1,
    })
    .where(
      and(
        eq(timerSessions.id, input.timerSessionId),
        eq(timerSessions.userId, input.userId),
        eq(timerSessions.workspaceId, input.workspaceId),
        eq(timerSessions.version, input.expectedVersion),
        ne(timerSessions.status, "completed"),
      ),
    )
    .returning({ id: timerSessions.id })

  return record ?? null
}

export async function closeGroupStudySessionRecord(
  database: DatabaseExecutor,
  input: Readonly<{
    expectedVersion: number
    groupSessionId: string
    now: Date
    workspaceId: string
  }>,
) {
  await database
    .update(groupStudySessions)
    .set({
      endedAt: input.now,
      status: "closed",
      updatedAt: input.now,
      version: input.expectedVersion + 1,
    })
    .where(
      and(
        eq(groupStudySessions.id, input.groupSessionId),
        eq(groupStudySessions.workspaceId, input.workspaceId),
        eq(groupStudySessions.status, "active"),
        eq(groupStudySessions.version, input.expectedVersion),
      ),
    )
}

export async function listActiveGroupStudyParticipants(
  database: DatabaseExecutor,
  workspaceId: string,
  groupSessionId: string,
) {
  return database
    .select({
      accumulatedMs: timerSessions.accumulatedMs,
      id: groupStudyParticipants.id,
      joinedAt: groupStudyParticipants.joinedAt,
      lastStartedAt: timerSessions.lastStartedAt,
      name: users.name,
      status: timerSessions.status,
      subject: timerSessions.subject,
      timerSessionId: timerSessions.id,
      userId: users.id,
    })
    .from(groupStudyParticipants)
    .innerJoin(users, eq(users.id, groupStudyParticipants.userId))
    .innerJoin(
      timerSessions,
      eq(timerSessions.id, groupStudyParticipants.timerSessionId),
    )
    .innerJoin(
      groupStudySessions,
      eq(groupStudySessions.id, groupStudyParticipants.groupSessionId),
    )
    .where(
      and(
        eq(groupStudyParticipants.groupSessionId, groupSessionId),
        eq(groupStudySessions.workspaceId, workspaceId),
        isNull(groupStudyParticipants.leftAt),
      ),
    )
    .orderBy(groupStudyParticipants.joinedAt)
}

export async function listGroupStudyActivities(
  database: DatabaseExecutor,
  workspaceId: string,
  groupSessionId: string,
) {
  return database
    .select({
      action: groupStudyActivities.action,
      id: groupStudyActivities.id,
      name: users.name,
      occurredAt: groupStudyActivities.occurredAt,
      timerElapsedMs: groupStudyActivities.timerElapsedMs,
      userId: groupStudyActivities.userId,
    })
    .from(groupStudyActivities)
    .innerJoin(users, eq(users.id, groupStudyActivities.userId))
    .innerJoin(
      groupStudySessions,
      eq(groupStudySessions.id, groupStudyActivities.groupSessionId),
    )
    .where(
      and(
        eq(groupStudyActivities.groupSessionId, groupSessionId),
        eq(groupStudySessions.workspaceId, workspaceId),
      ),
    )
    .orderBy(desc(groupStudyActivities.occurredAt))
}

export async function listGroupStudyMembershipHistory(
  database: DatabaseExecutor,
  access: AccessContext,
  options: Readonly<{
    /** Only rooms the user left on or after this instant (SQL-side date filter). */
    leftAfter?: Date
    /** Bound the number of rooms returned, newest joins first. */
    limit?: number
  }> = {},
) {
  return database
    .select({
      endedAt: groupStudySessions.endedAt,
      groupSessionId: groupStudySessions.id,
      joinedAt: groupStudyParticipants.joinedAt,
      leftAt: groupStudyParticipants.leftAt,
      name: groupStudySessions.name,
      subject: groupStudySessions.subject,
      workspaceId: groupStudySessions.workspaceId,
    })
    .from(groupStudyParticipants)
    .innerJoin(
      groupStudySessions,
      eq(groupStudySessions.id, groupStudyParticipants.groupSessionId),
    )
    .innerJoin(
      timerSessions,
      eq(timerSessions.id, groupStudyParticipants.timerSessionId),
    )
    .where(
      and(
        eq(groupStudyParticipants.userId, access.userId),
        eq(timerSessions.workspaceId, access.workspaceId),
        isNotNull(groupStudyParticipants.leftAt),
        options.leftAfter
          ? gte(groupStudyParticipants.leftAt, options.leftAfter)
          : undefined,
        activeAccessPredicate(database, access),
      ),
    )
    .orderBy(desc(groupStudyParticipants.joinedAt))
    .limit(options.limit ?? 100)
}

/**
 * Batched replacement for per-room activity queries. Callers bound roomIds
 * (see getGroupStudyHistory) and must cap rows per room in memory.
 */
export async function listGroupStudyActivitiesForRooms(
  database: DatabaseExecutor,
  workspaceId: string,
  groupSessionIds: readonly string[],
) {
  if (groupSessionIds.length === 0) return []
  return database
    .select({
      action: groupStudyActivities.action,
      groupSessionId: groupStudyActivities.groupSessionId,
      id: groupStudyActivities.id,
      name: users.name,
      occurredAt: groupStudyActivities.occurredAt,
      timerElapsedMs: groupStudyActivities.timerElapsedMs,
      userId: groupStudyActivities.userId,
    })
    .from(groupStudyActivities)
    .innerJoin(users, eq(users.id, groupStudyActivities.userId))
    .innerJoin(
      groupStudySessions,
      eq(groupStudySessions.id, groupStudyActivities.groupSessionId),
    )
    .where(
      and(
        inArray(groupStudyActivities.groupSessionId, [...groupSessionIds]),
        eq(groupStudySessions.workspaceId, workspaceId),
      ),
    )
    .orderBy(desc(groupStudyActivities.occurredAt))
    .limit(500)
}

/**
 * Batched replacement for per-room participant summary queries.
 */
export async function listGroupStudyParticipantSummariesForRooms(
  database: DatabaseExecutor,
  workspaceId: string,
  groupSessionIds: readonly string[],
) {
  if (groupSessionIds.length === 0) return []
  return database
    .select({
      groupSessionId: groupStudyParticipants.groupSessionId,
      joinedAt: groupStudyParticipants.joinedAt,
      leftAt: groupStudyParticipants.leftAt,
      name: users.name,
      totalMs: timerSessions.accumulatedMs,
      userId: users.id,
    })
    .from(groupStudyParticipants)
    .innerJoin(users, eq(users.id, groupStudyParticipants.userId))
    .innerJoin(
      timerSessions,
      eq(timerSessions.id, groupStudyParticipants.timerSessionId),
    )
    .innerJoin(
      groupStudySessions,
      eq(groupStudySessions.id, groupStudyParticipants.groupSessionId),
    )
    .where(
      and(
        inArray(groupStudyParticipants.groupSessionId, [...groupSessionIds]),
        eq(groupStudySessions.workspaceId, workspaceId),
      ),
    )
    .orderBy(groupStudyParticipants.joinedAt)
}

export async function listGroupStudyParticipantSummaries(
  database: DatabaseExecutor,
  workspaceId: string,
  groupSessionId: string,
) {
  return database
    .select({
      joinedAt: groupStudyParticipants.joinedAt,
      leftAt: groupStudyParticipants.leftAt,
      name: users.name,
      totalMs: timerSessions.accumulatedMs,
      userId: users.id,
    })
    .from(groupStudyParticipants)
    .innerJoin(users, eq(users.id, groupStudyParticipants.userId))
    .innerJoin(
      timerSessions,
      eq(timerSessions.id, groupStudyParticipants.timerSessionId),
    )
    .innerJoin(
      groupStudySessions,
      eq(groupStudySessions.id, groupStudyParticipants.groupSessionId),
    )
    .where(
      and(
        eq(groupStudyParticipants.groupSessionId, groupSessionId),
        eq(groupStudySessions.workspaceId, workspaceId),
      ),
    )
    .orderBy(groupStudyParticipants.joinedAt)
}

/**
 * Updates the lastHeartbeatAt timestamp for an active participant, signalling
 * that their browser tab is still alive.
 */
export async function updateParticipantHeartbeat(
  database: DatabaseExecutor,
  access: AccessContext,
  participantId: string,
) {
  await database
    .update(groupStudyParticipants)
    .set({
      lastHeartbeatAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(groupStudyParticipants.id, participantId),
        eq(groupStudyParticipants.userId, access.userId),
        isNull(groupStudyParticipants.leftAt),
        exists(
          database
            .select({ id: timerSessions.id })
            .from(timerSessions)
            .where(
              and(
                eq(timerSessions.id, groupStudyParticipants.timerSessionId),
                eq(timerSessions.workspaceId, access.workspaceId),
                activeAccessPredicate(database, access),
              ),
            ),
        ),
      ),
    )
}

/** Touches the caller's active room membership without a preceding lookup. */
export async function updateActiveParticipantHeartbeat(
  database: DatabaseExecutor,
  access: AccessContext,
) {
  await database
    .update(groupStudyParticipants)
    .set({
      lastHeartbeatAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(groupStudyParticipants.userId, access.userId),
        isNull(groupStudyParticipants.leftAt),
        exists(
          database
            .select({ id: timerSessions.id })
            .from(timerSessions)
            .where(
              and(
                eq(timerSessions.id, groupStudyParticipants.timerSessionId),
                eq(timerSessions.workspaceId, access.workspaceId),
                activeAccessPredicate(database, access),
              ),
            ),
        ),
        exists(
          database
            .select({ id: groupStudySessions.id })
            .from(groupStudySessions)
            .where(
              and(
                eq(
                  groupStudySessions.id,
                  groupStudyParticipants.groupSessionId,
                ),
                eq(groupStudySessions.status, "active"),
              ),
            ),
        ),
      ),
    )
}

/**
 * Finds active participants whose lastHeartbeatAt is older than the given
 * cutoff (or is NULL, meaning they never sent a heartbeat and their record
 * is older than the cutoff based on joinedAt).
 *
 * Used by the stale-rooms cron job to evict disconnected participants.
 */
export async function findStaleParticipants(
  database: DatabaseExecutor,
  cutoff: Date,
) {
  return database
    .select({
      accumulatedMs: timerSessions.accumulatedMs,
      groupSessionId: groupStudyParticipants.groupSessionId,
      id: groupStudyParticipants.id,
      lastStartedAt: timerSessions.lastStartedAt,
      status: timerSessions.status,
      timerSessionId: timerSessions.id,
      timerVersion: timerSessions.version,
      timerWorkspaceId: timerSessions.workspaceId,
      userId: groupStudyParticipants.userId,
      workspaceId: groupStudySessions.workspaceId,
    })
    .from(groupStudyParticipants)
    .innerJoin(
      groupStudySessions,
      eq(groupStudySessions.id, groupStudyParticipants.groupSessionId),
    )
    .innerJoin(
      timerSessions,
      eq(timerSessions.id, groupStudyParticipants.timerSessionId),
    )
    .where(
      and(
        isNull(groupStudyParticipants.leftAt),
        eq(groupStudySessions.status, "active"),
        ne(timerSessions.status, "completed"),
        // Stale if lastHeartbeatAt is before the cutoff, OR if it is NULL and
        // the participant joined before the cutoff (pre-heartbeat records).
        sql`(
          ${groupStudyParticipants.lastHeartbeatAt} < ${cutoff.toISOString()}
          OR (
            ${groupStudyParticipants.lastHeartbeatAt} IS NULL
            AND ${groupStudyParticipants.joinedAt} < ${cutoff.toISOString()}
          )
        )`,
      ),
    )
}

export async function findPendingJoinRequestForUser(
  database: DatabaseExecutor,
  groupSessionId: string,
  userId: string,
) {
  const [record] = await database
    .select()
    .from(groupStudyJoinRequests)
    .where(
      and(
        eq(groupStudyJoinRequests.groupSessionId, groupSessionId),
        eq(groupStudyJoinRequests.userId, userId),
        eq(groupStudyJoinRequests.status, "pending"),
      ),
    )
    .limit(1)

  return record ?? null
}

export async function findLatestJoinRequestForUser(
  database: DatabaseExecutor,
  groupSessionId: string,
  userId: string,
) {
  const [record] = await database
    .select()
    .from(groupStudyJoinRequests)
    .where(
      and(
        eq(groupStudyJoinRequests.groupSessionId, groupSessionId),
        eq(groupStudyJoinRequests.userId, userId),
      ),
    )
    .orderBy(desc(groupStudyJoinRequests.createdAt))
    .limit(1)

  return record ?? null
}

export async function consumeApprovedJoinRequest(
  database: DatabaseExecutor,
  input: Readonly<{ now: Date; requestId: string }>,
) {
  const [record] = await database
    .delete(groupStudyJoinRequests)
    .where(
      and(
        eq(groupStudyJoinRequests.id, input.requestId),
        eq(groupStudyJoinRequests.status, "approved"),
      ),
    )
    .returning({ id: groupStudyJoinRequests.id })

  return record ?? null
}

export async function createGroupStudyJoinRequestRecord(
  database: DatabaseExecutor,
  input: Readonly<{ groupSessionId: string; now: Date; userId: string }>,
) {
  const existing = await findPendingJoinRequestForUser(
    database,
    input.groupSessionId,
    input.userId,
  )
  if (existing) return existing

  const [record] = await database
    .insert(groupStudyJoinRequests)
    .values({
      createdAt: input.now,
      groupSessionId: input.groupSessionId,
      status: "pending",
      updatedAt: input.now,
      userId: input.userId,
    })
    .returning()

  return record ?? null
}

export async function updateGroupStudyJoinRequestStatus(
  database: DatabaseExecutor,
  input: Readonly<{
    now: Date
    requestId: string
    status: "approved" | "rejected"
  }>,
) {
  const [record] = await database
    .update(groupStudyJoinRequests)
    .set({ status: input.status, updatedAt: input.now })
    .where(eq(groupStudyJoinRequests.id, input.requestId))
    .returning()
  return record ?? null
}

export async function findPendingJoinRequestsForRoom(
  database: DatabaseExecutor,
  groupSessionId: string,
) {
  return database
    .select({
      id: groupStudyJoinRequests.id,
      userId: groupStudyJoinRequests.userId,
      name: users.name,
      createdAt: groupStudyJoinRequests.createdAt,
    })
    .from(groupStudyJoinRequests)
    .innerJoin(users, eq(users.id, groupStudyJoinRequests.userId))
    .where(
      and(
        eq(groupStudyJoinRequests.groupSessionId, groupSessionId),
        eq(groupStudyJoinRequests.status, "pending"),
      ),
    )
    .orderBy(desc(groupStudyJoinRequests.createdAt))
}
