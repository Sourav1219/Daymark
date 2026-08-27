import "server-only"

import { getDatabase, type Database } from "@/db/client"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import {
  calculateCompletionStreak,
  getLevelProgress,
  localWeekBounds,
} from "@/features/progression/domain/progression"
import {
  findProgressionRecord,
  getQuestPointGoalsRecord,
  getDailyXpSummaryRecord,
  listEffectiveAwards,
  listXpDeltasForLocalDateRange,
  listProgressionHistoryRecords,
} from "@/features/progression/repositories/progression-repository"
import { getUserSettings } from "@/features/reminders/queries/user-settings-query-service"

const historyLimit = 50

export async function getCurrentCompletionStreak(
  access: AccessContext,
  options: Readonly<{
    database?: Database
    now?: Date
    timezone: string
  }>,
) {
  const awards = await listEffectiveAwards(
    options.database ?? getDatabase(),
    access,
  )
  const today = localWeekBounds(
    options.now ?? new Date(),
    options.timezone,
  ).today

  return calculateCompletionStreak(
    awards.map(({ earnedForLocalDate }) => earnedForLocalDate),
    today,
  ).current
}

export async function getDailyXpSummary(
  access: AccessContext,
  localDate: string,
  database: Database = getDatabase(),
) {
  return getDailyXpSummaryRecord(database, access, localDate)
}

export async function getProgressionDashboard(
  access: AccessContext,
  options: Readonly<{
    database?: Database
    historyDate?: string
    now?: Date
    timezone?: string
  }> = {},
) {
  const database = options.database ?? getDatabase()
  const now = options.now ?? new Date()
  const timezone =
    options.timezone ?? (await getUserSettings(access, database)).timezone
  const week = localWeekBounds(now, timezone)
  const [projection, awards, history, pointGoals, periodDeltas] =
    await Promise.all([
      findProgressionRecord(database, access),
      listEffectiveAwards(database, access),
      listProgressionHistoryRecords(
        database,
        access,
        historyLimit,
        options.historyDate,
      ),
      getQuestPointGoalsRecord(database, access, {
        timezone,
        today: week.today,
        weekEnd: week.end,
        weekStart: week.start,
      }),
      listXpDeltasForLocalDateRange(database, access, week.start, week.end),
    ])
  const xp = projection?.experiencePoints ?? 0
  const streak = calculateCompletionStreak(
    awards.map(({ earnedForLocalDate }) => earnedForLocalDate),
    week.today,
  )
  const dailyXp = Math.max(
    0,
    periodDeltas
      .filter(({ earnedForLocalDate }) => earnedForLocalDate === week.today)
      .reduce((total, { xpDelta }) => total + xpDelta, 0),
  )
  const weeklyXp = Math.max(
    0,
    periodDeltas.reduce((total, { xpDelta }) => total + xpDelta, 0),
  )
  const progressPercent = (current: number, total: number) =>
    total > 0
      ? Math.max(0, Math.min(100, Math.floor((current / total) * 100)))
      : 0

  return {
    bestStreak: streak.best,
    currentStreak: streak.current,
    daily: {
      goal: pointGoals.daily,
      percent: progressPercent(dailyXp, pointGoals.daily),
      xp: dailyXp,
    },
    history: history.map((entry) => ({
      ...entry,
      occurredAt: entry.occurredAt.toISOString(),
    })),
    level: getLevelProgress(xp),
    timezone,
    totalXp: xp,
    weekly: {
      goal: pointGoals.weekly,
      percent: progressPercent(weeklyXp, pointGoals.weekly),
      xp: weeklyXp,
    },
  } as const
}
