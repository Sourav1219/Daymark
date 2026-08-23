import "server-only"

import { and, desc, eq, exists, gte, isNull, lte, or } from "drizzle-orm"

import type { DatabaseExecutor } from "@/db/client"
import { timerSessions, workspaceMembers, workspaces } from "@/db/schema"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import type { TimerSessionStatus } from "@/features/timer/domain/types"

export type TimerSessionRecord = Readonly<{
  accumulatedMs: number
  createdAt: Date
  endedAt: Date | null
  id: string
  lastStartedAt: Date | null
  startedAt: Date
  status: TimerSessionStatus
  subject: string
  updatedAt: Date
  version: number
}>

const selection = {
  accumulatedMs: timerSessions.accumulatedMs,
  createdAt: timerSessions.createdAt,
  endedAt: timerSessions.endedAt,
  id: timerSessions.id,
  lastStartedAt: timerSessions.lastStartedAt,
  startedAt: timerSessions.startedAt,
  status: timerSessions.status,
  subject: timerSessions.subject,
  updatedAt: timerSessions.updatedAt,
  version: timerSessions.version,
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

function sessionPredicate(
  database: DatabaseExecutor,
  access: AccessContext,
  sessionId: string,
) {
  return and(
    eq(timerSessions.id, sessionId),
    eq(timerSessions.workspaceId, access.workspaceId),
    eq(timerSessions.userId, access.userId),
    activeAccessPredicate(database, access),
  )
}

export async function findTimerSessionRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  sessionId: string,
) {
  const [record] = await database
    .select(selection)
    .from(timerSessions)
    .where(sessionPredicate(database, access, sessionId))
    .limit(1)

  return record ?? null
}

export async function findActiveTimerSessionRecord(
  database: DatabaseExecutor,
  access: AccessContext,
) {
  const [record] = await database
    .select(selection)
    .from(timerSessions)
    .where(
      and(
        eq(timerSessions.workspaceId, access.workspaceId),
        eq(timerSessions.userId, access.userId),
        or(
          eq(timerSessions.status, "running"),
          eq(timerSessions.status, "paused"),
        ),
        activeAccessPredicate(database, access),
      ),
    )
    .limit(1)

  return record ?? null
}

export async function listTimerSessionRecords(
  database: DatabaseExecutor,
  access: AccessContext,
  /** Optional: only return records whose startedAt is on or after this date (e.g. 90 days ago). */
  since?: Date,
  /** Optional hard cap on returned rows, newest first. */
  limit?: number,
) {
  return database
    .select(selection)
    .from(timerSessions)
    .where(
      and(
        eq(timerSessions.workspaceId, access.workspaceId),
        eq(timerSessions.userId, access.userId),
        since ? gte(timerSessions.startedAt, since) : undefined,
        activeAccessPredicate(database, access),
      ),
    )
    .orderBy(desc(timerSessions.startedAt))
    .limit(limit ?? 500)
}

/**
 * Returns only the completed timer sessions whose endedAt falls within
 * [dayStart, dayEnd]. Pushes the date filter to SQL, avoiding a full-table
 * scan and in-process filtering.
 */
export async function listTodayCompletedTimerSessions(
  database: DatabaseExecutor,
  access: AccessContext,
  dayStart: Date,
  dayEnd: Date,
) {
  return database
    .select(selection)
    .from(timerSessions)
    .where(
      and(
        eq(timerSessions.workspaceId, access.workspaceId),
        eq(timerSessions.userId, access.userId),
        eq(timerSessions.status, "completed"),
        gte(timerSessions.endedAt, dayStart),
        lte(timerSessions.endedAt, dayEnd),
        activeAccessPredicate(database, access),
      ),
    )
    .orderBy(desc(timerSessions.startedAt))
}

export async function createTimerSessionRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  subject: string,
  now: Date,
) {
  const [record] = await database
    .insert(timerSessions)
    .values({
      lastStartedAt: now,
      startedAt: now,
      subject,
      updatedAt: now,
      userId: access.userId,
      workspaceId: access.workspaceId,
    })
    .returning(selection)

  return record ?? null
}

export async function updateTimerSessionRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  input: Readonly<{
    accumulatedMs?: number
    endedAt?: Date | null
    expectedVersion: number
    lastStartedAt?: Date | null
    sessionId: string
    status?: TimerSessionStatus
    subject?: string
    updatedAt: Date
  }>,
) {
  const [record] = await database
    .update(timerSessions)
    .set({
      ...(input.accumulatedMs === undefined
        ? {}
        : { accumulatedMs: input.accumulatedMs }),
      ...(input.endedAt === undefined ? {} : { endedAt: input.endedAt }),
      ...(input.lastStartedAt === undefined
        ? {}
        : { lastStartedAt: input.lastStartedAt }),
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.subject === undefined ? {} : { subject: input.subject }),
      updatedAt: input.updatedAt,
      version: input.expectedVersion + 1,
    })
    .where(
      and(
        sessionPredicate(database, access, input.sessionId),
        eq(timerSessions.version, input.expectedVersion),
      ),
    )
    .returning(selection)

  return record ?? null
}
