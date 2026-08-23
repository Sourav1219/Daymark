import "server-only"

import {
  and,
  desc,
  eq,
  exists,
  gt,
  gte,
  isNotNull,
  isNull,
  lte,
  notExists,
  or,
  sql,
} from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import type { DatabaseExecutor } from "@/db/client"
import {
  activityEvents,
  tasks,
  userProgression,
  workspaceMembers,
  workspaces,
  xpLedger,
  type XpLedgerReason,
} from "@/db/schema"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import type { QuestActivityEventType } from "@/features/activity-events/domain/types"
import {
  calculateQuestXp,
  calculateCompletionStreak,
  getHunterRankProgress,
  localDateForInstant,
  maximumExperiencePoints,
  type HunterRank,
} from "@/features/progression/domain/progression"
import type { QuestPriority } from "@/features/quests/domain/types"

export type ProgressionMutationFeedback = Readonly<{
  currentStreak: number
  rank: HunterRank
  rankAdvanced: boolean
  streakIncreased: boolean
  timezone: string
  totalXp: number
  xpDelta: number
}>

type ProgressionQuest = Readonly<{
  completedAt: Date | null
  id: string
  priority: QuestPriority
  title: string
  version: number
  xpReward: number
}>

type RecordProgressionInput = Readonly<{
  eventType: QuestActivityEventType
  idempotencyKey: string
  occurredAt: Date
  /** Positive XP to deduct; required for "penalty" and ignored otherwise. */
  penalty?: number
  quest: ProgressionQuest
  reason?: XpLedgerReason
  timezone: string
  type: "activity" | "award" | "penalty" | "reverse"
}>

const reversedLedger = alias(xpLedger, "reversed_ledger")

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

async function currentProjection(
  database: DatabaseExecutor,
  access: AccessContext,
) {
  const [record] = await database
    .select({
      currentStreak: userProgression.currentStreak,
      experiencePoints: userProgression.experiencePoints,
    })
    .from(userProgression)
    .where(
      and(
        eq(userProgression.workspaceId, access.workspaceId),
        eq(userProgression.userId, access.userId),
      ),
    )
    .limit(1)

  return {
    currentStreak: record?.currentStreak ?? 0,
    experiencePoints: record?.experiencePoints ?? 0,
  }
}

/**
 * Authoritative XP total, summed from the ledger rather than read from the
 * projection. The projection row can be missing for a member who has not
 * earned anything yet, and it is only ever derived from this sum, so bounds
 * checks and penalty clamping must agree with it.
 */
async function currentLedgerTotal(
  database: DatabaseExecutor,
  access: AccessContext,
): Promise<number> {
  const [record] = await database
    .select({
      total: sql<number>`coalesce(sum(${xpLedger.xpDelta}), 0)::integer`,
    })
    .from(xpLedger)
    .where(
      and(
        eq(xpLedger.workspaceId, access.workspaceId),
        eq(xpLedger.userId, access.userId),
      ),
    )

  return record?.total ?? 0
}

async function findActiveQuestAward(
  database: DatabaseExecutor,
  access: AccessContext,
  questId: string,
) {
  const reversal = alias(xpLedger, "quest_award_reversal")
  const [entry] = await database
    .select({
      earnedForLocalDate: xpLedger.earnedForLocalDate,
      id: xpLedger.id,
      xpDelta: xpLedger.xpDelta,
    })
    .from(xpLedger)
    .where(
      and(
        eq(xpLedger.workspaceId, access.workspaceId),
        eq(xpLedger.userId, access.userId),
        eq(xpLedger.questId, questId),
        gt(xpLedger.xpDelta, 0),
        notExists(
          database
            .select({ id: reversal.id })
            .from(reversal)
            .where(
              and(
                eq(reversal.workspaceId, xpLedger.workspaceId),
                eq(reversal.reversesLedgerEntryId, xpLedger.id),
              ),
            ),
        ),
      ),
    )
    .orderBy(desc(xpLedger.createdAt))
    .limit(1)

  return entry ?? null
}

/**
 * Counts miss penalties already charged on a local date. Drives the escalating
 * cost of repeat misses within the same day.
 */
export async function countFailurePenalties(
  database: DatabaseExecutor,
  access: AccessContext,
  localDate: string,
): Promise<number> {
  const [record] = await database
    .select({ value: sql<number>`count(*)::integer` })
    .from(xpLedger)
    .where(
      and(
        eq(xpLedger.workspaceId, access.workspaceId),
        eq(xpLedger.userId, access.userId),
        eq(xpLedger.reason, "quest_failure_penalty"),
        eq(xpLedger.earnedForLocalDate, localDate),
      ),
    )

  return record?.value ?? 0
}

async function rebuildProgressionProjection(
  database: DatabaseExecutor,
  access: AccessContext,
  timezone: string,
  now: Date,
) {
  const [totalRecord, activeDates] = await Promise.all([
    database
      .select({
        total: sql<number>`coalesce(sum(${xpLedger.xpDelta}), 0)::integer`,
      })
      .from(xpLedger)
      .where(
        and(
          eq(xpLedger.workspaceId, access.workspaceId),
          eq(xpLedger.userId, access.userId),
        ),
      )
      .then((rows) => rows[0]),
    listEffectiveAwards(database, access),
  ])
  const total = totalRecord?.total ?? 0
  if (total < 0 || total > maximumExperiencePoints) {
    throw new Error("Progression XP projection exceeded its safe bounds")
  }

  const streak = calculateCompletionStreak(
    activeDates.map(({ earnedForLocalDate }) => earnedForLocalDate),
    localDateForInstant(now, timezone),
  )
  const rank = getHunterRankProgress(total)

  const [projection] = await database
    .insert(userProgression)
    .values({
      bestStreak: streak.best,
      currentStreak: streak.current,
      experiencePoints: total,
      hunterLevel: rank.level,
      hunterRank: rank.rank,
      lastClearedLocalDate: streak.lastClearedLocalDate,
      userId: access.userId,
      workspaceId: access.workspaceId,
    })
    .onConflictDoUpdate({
      target: [userProgression.workspaceId, userProgression.userId],
      set: {
        bestStreak: streak.best,
        currentStreak: streak.current,
        experiencePoints: total,
        hunterLevel: rank.level,
        hunterRank: rank.rank,
        lastClearedLocalDate: streak.lastClearedLocalDate,
        updatedAt: now,
        version: sql`${userProgression.version} + 1`,
      },
    })
    .returning({
      currentStreak: userProgression.currentStreak,
      experiencePoints: userProgression.experiencePoints,
      hunterRank: userProgression.hunterRank,
    })

  if (!projection) throw new Error("Unable to rebuild progression projection")
  return projection
}

export async function recordQuestProgression(
  database: DatabaseExecutor,
  access: AccessContext,
  input: RecordProgressionInput,
): Promise<ProgressionMutationFeedback> {
  const beforeXp = await currentLedgerTotal(database, access)
  const activeAward =
    input.type === "reverse"
      ? await findActiveQuestAward(database, access, input.quest.id)
      : null
  // A penalty never drives the running total below zero: the deduction is
  // clamped to whatever XP is banked, and clamping to nothing records the
  // event without a ledger row.
  const clampedPenalty = Math.min(
    Math.max(0, Math.trunc(input.penalty ?? 0)),
    beforeXp,
  )
  const xpDelta =
    input.type === "award"
      ? input.quest.xpReward
      : input.type === "penalty"
        ? -clampedPenalty
        : input.type === "reverse" && activeAward
          ? -activeAward.xpDelta
          : 0
  const earnedForLocalDate =
    activeAward?.earnedForLocalDate ??
    localDateForInstant(
      input.quest.completedAt ?? input.occurredAt,
      input.timezone,
    )
  const predictedXp = beforeXp + xpDelta
  if (predictedXp < 0 || predictedXp > maximumExperiencePoints) {
    throw new Error("Progression XP event exceeded its safe bounds")
  }
  const beforeRank = getHunterRankProgress(beforeXp)
  const predictedRank = getHunterRankProgress(predictedXp)
  const rankAdvanced = predictedRank.level > beforeRank.level
  const effectiveAwards = await listEffectiveAwards(database, access)
  const predictedDates = effectiveAwards.map(
    (award) => award.earnedForLocalDate,
  )
  const currentLocalDate = localDateForInstant(input.occurredAt, input.timezone)
  const beforeStreak = calculateCompletionStreak(
    predictedDates,
    currentLocalDate,
  ).current
  if (input.type === "reverse" && activeAward) {
    const reversedDateIndex = predictedDates.indexOf(
      activeAward.earnedForLocalDate,
    )
    if (reversedDateIndex >= 0) predictedDates.splice(reversedDateIndex, 1)
  }
  if (input.type === "award") predictedDates.push(earnedForLocalDate)
  const predictedStreak = calculateCompletionStreak(
    predictedDates,
    currentLocalDate,
  ).current
  const streakIncreased =
    input.type === "award" && predictedStreak > beforeStreak

  const [event] = await database
    .insert(activityEvents)
    .values({
      actorUserId: access.userId,
      eventType: input.eventType,
      idempotencyKey: input.idempotencyKey,
      occurredAt: input.occurredAt,
      payload: {
        currentStreak: predictedStreak,
        priority: input.quest.priority,
        questTitle: input.quest.title,
        questVersion: input.quest.version,
        rank: predictedRank.rank,
        rankAdvanced,
        streakIncreased,
        timezone: input.timezone,
        totalXp: predictedXp,
        xpDelta,
      },
      subjectId: input.quest.id,
      subjectType: "quest",
      workspaceId: access.workspaceId,
    })
    .onConflictDoNothing()
    .returning({ id: activityEvents.id })

  if (!event) {
    const current = await currentProjection(database, access)
    return {
      currentStreak: current.currentStreak,
      rank: getHunterRankProgress(current.experiencePoints).rank,
      rankAdvanced: false,
      streakIncreased: false,
      timezone: input.timezone,
      totalXp: current.experiencePoints,
      xpDelta: 0,
    }
  }

  if (xpDelta !== 0 && input.reason) {
    await database.insert(xpLedger).values({
      activityEventId: event.id,
      earnedForLocalDate,
      questId: input.quest.id,
      reason: input.reason,
      reversesLedgerEntryId: activeAward?.id ?? null,
      userId: access.userId,
      workspaceId: access.workspaceId,
      xpDelta,
    })
  }

  const projection = await rebuildProgressionProjection(
    database,
    access,
    input.timezone,
    input.occurredAt,
  )
  return {
    currentStreak: projection.currentStreak,
    rank: projection.hunterRank,
    rankAdvanced,
    streakIncreased,
    timezone: input.timezone,
    totalXp: projection.experiencePoints,
    xpDelta,
  }
}

export async function findProgressionEventFeedback(
  database: DatabaseExecutor,
  access: AccessContext,
  idempotencyKey: string,
): Promise<ProgressionMutationFeedback | null> {
  const [event] = await database
    .select({ payload: activityEvents.payload })
    .from(activityEvents)
    .where(
      and(
        eq(activityEvents.workspaceId, access.workspaceId),
        eq(activityEvents.actorUserId, access.userId),
        eq(activityEvents.idempotencyKey, idempotencyKey),
        activeAccessPredicate(database, access),
      ),
    )
    .limit(1)

  return event
    ? {
        currentStreak: event.payload.currentStreak ?? 0,
        rank: event.payload.rank,
        rankAdvanced: event.payload.rankAdvanced,
        streakIncreased: event.payload.streakIncreased ?? false,
        timezone: event.payload.timezone,
        totalXp: event.payload.totalXp,
        xpDelta: event.payload.xpDelta,
      }
    : null
}

export function listEffectiveAwards(
  database: DatabaseExecutor,
  access: AccessContext,
) {
  return database
    .select({
      earnedForLocalDate: xpLedger.earnedForLocalDate,
      xpDelta: xpLedger.xpDelta,
    })
    .from(xpLedger)
    .where(
      and(
        eq(xpLedger.workspaceId, access.workspaceId),
        eq(xpLedger.userId, access.userId),
        gt(xpLedger.xpDelta, 0),
        notExists(
          database
            .select({ id: reversedLedger.id })
            .from(reversedLedger)
            .where(
              and(
                eq(reversedLedger.workspaceId, xpLedger.workspaceId),
                eq(reversedLedger.reversesLedgerEntryId, xpLedger.id),
              ),
            ),
        ),
        activeAccessPredicate(database, access),
      ),
    )
}

export function listXpDeltasForLocalDateRange(
  database: DatabaseExecutor,
  access: AccessContext,
  start: string,
  end: string,
) {
  return database
    .select({
      earnedForLocalDate: xpLedger.earnedForLocalDate,
      xpDelta: xpLedger.xpDelta,
    })
    .from(xpLedger)
    .where(
      and(
        eq(xpLedger.workspaceId, access.workspaceId),
        eq(xpLedger.userId, access.userId),
        gte(xpLedger.earnedForLocalDate, start),
        lte(xpLedger.earnedForLocalDate, end),
        activeAccessPredicate(database, access),
      ),
    )
}

export async function getQuestPointGoalsRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  options: Readonly<{
    today: string
    timezone: string
    weekEnd: string
    weekStart: string
  }>,
): Promise<Readonly<{ daily: number; weekly: number }>> {
  const scoreInstant = sql<Date>`case
    when ${tasks.status} = 'completed' and ${tasks.completedAt} is not null
      then ${tasks.completedAt}
    when ${tasks.status} = 'failed' and ${tasks.dueAt} is not null
      then ${tasks.dueAt}
    else coalesce(${tasks.dueAt}, ${tasks.startAt}, ${tasks.createdAt})
  end`
  const scoreLocalDate = sql<string>`to_char(timezone(${options.timezone}, ${scoreInstant}), 'YYYY-MM-DD')`
  const rows = await database
    .select({ localDate: scoreLocalDate, priority: tasks.priority })
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceId, access.workspaceId),
        or(
          isNull(tasks.deletedAt),
          eq(tasks.status, "failed"),
          eq(tasks.status, "completed"),
        ),
        gte(scoreLocalDate, options.weekStart),
        lte(scoreLocalDate, options.weekEnd),
        activeAccessPredicate(database, access),
      ),
    )

  return rows.reduce(
    (totals, task) => {
      const points = calculateQuestXp(task.priority)
      totals.weekly += points
      if (task.localDate === options.today) totals.daily += points
      return totals
    },
    { daily: 0, weekly: 0 },
  )
}

export async function findProgressionRecord(
  database: DatabaseExecutor,
  access: AccessContext,
) {
  const [record] = await database
    .select({
      bestStreak: userProgression.bestStreak,
      experiencePoints: userProgression.experiencePoints,
      hunterLevel: userProgression.hunterLevel,
      hunterRank: userProgression.hunterRank,
      lastClearedLocalDate: userProgression.lastClearedLocalDate,
    })
    .from(userProgression)
    .where(
      and(
        eq(userProgression.workspaceId, access.workspaceId),
        eq(userProgression.userId, access.userId),
        activeAccessPredicate(database, access),
      ),
    )
    .limit(1)

  return record ?? null
}

export function listProgressionHistoryRecords(
  database: DatabaseExecutor,
  access: AccessContext,
  limit: number,
  localDate?: string,
) {
  return database
    .select({
      earnedForLocalDate: xpLedger.earnedForLocalDate,
      eventType: activityEvents.eventType,
      occurredAt: activityEvents.occurredAt,
      questId: tasks.id,
      questTitle: tasks.title,
      reason: xpLedger.reason,
      xpDelta: xpLedger.xpDelta,
    })
    .from(xpLedger)
    .innerJoin(
      activityEvents,
      and(
        eq(activityEvents.id, xpLedger.activityEventId),
        eq(activityEvents.workspaceId, xpLedger.workspaceId),
      ),
    )
    .innerJoin(
      tasks,
      and(
        eq(tasks.id, xpLedger.questId),
        eq(tasks.workspaceId, xpLedger.workspaceId),
      ),
    )
    .where(
      and(
        eq(xpLedger.workspaceId, access.workspaceId),
        eq(xpLedger.userId, access.userId),
        isNotNull(xpLedger.earnedForLocalDate),
        localDate ? eq(xpLedger.earnedForLocalDate, localDate) : undefined,
        activeAccessPredicate(database, access),
      ),
    )
    .orderBy(desc(activityEvents.occurredAt), desc(xpLedger.createdAt))
    .limit(limit)
}

export async function getDailyXpSummaryRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  localDate: string,
) {
  const [record] = await database
    .select({
      earned: sql<number>`coalesce(sum(case when ${xpLedger.xpDelta} > 0 then ${xpLedger.xpDelta} else 0 end), 0)::integer`,
      lost: sql<number>`coalesce(sum(case when ${xpLedger.xpDelta} < 0 then abs(${xpLedger.xpDelta}) else 0 end), 0)::integer`,
      net: sql<number>`coalesce(sum(${xpLedger.xpDelta}), 0)::integer`,
    })
    .from(xpLedger)
    .where(
      and(
        eq(xpLedger.workspaceId, access.workspaceId),
        eq(xpLedger.userId, access.userId),
        eq(xpLedger.earnedForLocalDate, localDate),
        activeAccessPredicate(database, access),
      ),
    )

  return record ?? { earned: 0, lost: 0, net: 0 }
}
