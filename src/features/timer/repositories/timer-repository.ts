import "server-only"

import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm"

import type { DatabaseExecutor } from "@/db/client"
import { timerSessions } from "@/db/schema"
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

function sessionPredicate(
  database: DatabaseExecutor,
  access: AccessContext,
  sessionId: string,
) {
  return and(
    eq(timerSessions.id, sessionId),
    eq(timerSessions.workspaceId, access.workspaceId),
    eq(timerSessions.userId, access.userId),
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
      ),
    )
    .orderBy(desc(timerSessions.startedAt))
}

/**
 * Aggregates the bounded chart window inside PostgreSQL. Sessions spanning
 * midnight are split at local-day boundaries, including 23/25-hour DST days.
 */
export async function listDailyStudySummaryRecords(
  database: DatabaseExecutor,
  access: AccessContext,
  timezone: string,
  since: Date,
) {
  const rows = await database.execute(sql`
    with completed as (
      select started_at, ended_at, accumulated_ms
      from ${timerSessions}
      where workspace_id = ${access.workspaceId}::uuid
        and user_id = ${access.userId}::uuid
        and status = 'completed'
        and ended_at is not null
        and ended_at >= ${since.toISOString()}::timestamptz
    ), segments as (
      select
        completed.*,
        local_day,
        greatest(
          completed.started_at,
          local_day at time zone ${timezone}
        ) as segment_start,
        least(
          completed.ended_at,
          (local_day + interval '1 day') at time zone ${timezone}
        ) as segment_end
      from completed
      cross join lateral generate_series(
        date_trunc('day', timezone(${timezone}, completed.started_at)),
        date_trunc('day', timezone(${timezone}, completed.ended_at)),
        interval '1 day'
      ) as local_day
    )
    select
      to_char(local_day, 'YYYY-MM-DD') as "localDate",
      count(*) filter (
        where date_trunc('day', timezone(${timezone}, ended_at)) = local_day
      )::integer as "sessionCount",
      round(sum(
        greatest(0, extract(epoch from (segment_end - segment_start)) * 1000)
      ))::bigint as "totalMs"
    from segments
    where segment_end > segment_start
    group by local_day
    order by local_day desc
  `)

  return rows.map((row) => ({
    localDate: String(row.localDate),
    sessionCount: Number(row.sessionCount),
    totalMs: Number(row.totalMs),
  }))
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
