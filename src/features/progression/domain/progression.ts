import type { QuestPriority } from "@/features/quests/domain/types"

export const maximumExperiencePoints = 2_000_000_000

export type LevelProgress = Readonly<{
  currentThreshold: number
  level: number
  nextThreshold: number
  percent: number
  pointsInLevel: number
  pointsToNextLevel: number
  pointsForLevel: number
}>

/**
 * Levels use an open-ended curve: level 1 needs 100 points and every next
 * level asks for 50 more points than the previous one.
 */
export function getLevelProgress(points: number): LevelProgress {
  const boundedPoints = Math.max(
    0,
    Math.min(Math.trunc(points), maximumExperiencePoints),
  )
  const completedLevels = Math.max(
    0,
    Math.floor((-75 + Math.sqrt(5_625 + 100 * boundedPoints)) / 50),
  )
  const level = completedLevels + 1
  const currentThreshold =
    25 * completedLevels * completedLevels + 75 * completedLevels
  const pointsForLevel = 100 + 50 * completedLevels
  const nextThreshold = currentThreshold + pointsForLevel
  const pointsInLevel = boundedPoints - currentThreshold

  return {
    currentThreshold,
    level,
    nextThreshold,
    percent: Math.min(100, Math.floor((pointsInLevel / pointsForLevel) * 100)),
    pointsForLevel,
    pointsInLevel,
    pointsToNextLevel: nextThreshold - boundedPoints,
  }
}

export const hunterRanks = [
  { level: 1, rank: "E", threshold: 0 },
  { level: 2, rank: "D", threshold: 250 },
  { level: 3, rank: "C", threshold: 750 },
  { level: 4, rank: "B", threshold: 1_500 },
  { level: 5, rank: "A", threshold: 3_000 },
  { level: 6, rank: "S", threshold: 5_000 },
] as const

export type HunterRank = (typeof hunterRanks)[number]["rank"]

export type HunterRankProgress = Readonly<{
  level: number
  rank: HunterRank
  currentThreshold: number
  nextRank: HunterRank | null
  nextThreshold: number | null
  percent: number
  xpIntoRank: number
  xpToNextRank: number | null
}>

const questXpByPriority: Readonly<Record<QuestPriority, number>> = {
  critical: 50,
  high: 35,
  low: 10,
  medium: 20,
}

/** XP is based only on server-loaded Quest state; no client value is accepted. */
export function calculateQuestXp(priority: QuestPriority): number {
  return questXpByPriority[priority]
}

/** Extra XP charged for each additional missed task within the same local day. */
export const failurePenaltyEscalation = 5

/** Ceiling on a single penalty, mirroring the xp_ledger delta constraint. */
export const maximumFailurePenalty = 500

/**
 * Cost of missing a task. The first miss of a local day costs the task's own
 * XP value; every later miss that day adds a flat escalation on top, so a
 * repeated 10 XP miss costs 10, then 15, then 20.
 *
 * @param priority Priority of the missed task, which sets the base cost.
 * @param failuresToday Misses already penalised earlier in the same local day.
 */
export function calculateFailurePenalty(
  priority: QuestPriority,
  failuresToday: number,
): number {
  const priorFailures = Math.max(0, Math.trunc(failuresToday))
  const penalty =
    calculateQuestXp(priority) + failurePenaltyEscalation * priorFailures

  return Math.min(penalty, maximumFailurePenalty)
}

export function getHunterRankProgress(
  experiencePoints: number,
): HunterRankProgress {
  const boundedXp = Math.max(
    0,
    Math.min(Math.trunc(experiencePoints), maximumExperiencePoints),
  )
  let index = hunterRanks.findLastIndex(
    ({ threshold }) => boundedXp >= threshold,
  )
  if (index < 0) index = 0

  const current = hunterRanks[index] ?? hunterRanks[0]
  const next = hunterRanks[index + 1] ?? null
  const xpIntoRank = boundedXp - current.threshold
  const span = next ? next.threshold - current.threshold : 0

  return {
    currentThreshold: current.threshold,
    level: current.level,
    nextRank: next?.rank ?? null,
    nextThreshold: next?.threshold ?? null,
    percent: next ? Math.min(100, Math.floor((xpIntoRank / span) * 100)) : 100,
    rank: current.rank,
    xpIntoRank,
    xpToNextRank: next ? next.threshold - boundedXp : null,
  }
}

export type StreakState = Readonly<{
  best: number
  current: number
  lastClearedLocalDate: string | null
}>

/**
 * Derives streaks from effective completion dates. Multiple clears on one day
 * count once. A streak remains current through the day after its latest clear.
 */
export function calculateCompletionStreak(
  localDates: readonly string[],
  todayLocalDate: string,
): StreakState {
  const sortedDates = [...new Set(localDates)].sort()
  if (sortedDates.length === 0) {
    return { best: 0, current: 0, lastClearedLocalDate: null }
  }

  let best = 1
  let run = 1
  for (let index = 1; index < sortedDates.length; index += 1) {
    const previous = Date.parse(`${sortedDates[index - 1]}T00:00:00Z`)
    const current = Date.parse(`${sortedDates[index]}T00:00:00Z`)
    run = (current - previous) / 86_400_000 === 1 ? run + 1 : 1
    best = Math.max(best, run)
  }

  const last = sortedDates.at(-1)!
  const today = Date.parse(`${todayLocalDate}T00:00:00Z`)
  const lastDate = Date.parse(`${last}T00:00:00Z`)
  const daysSinceClear = (today - lastDate) / 86_400_000

  if (daysSinceClear !== 0 && daysSinceClear !== 1) {
    return { best, current: 0, lastClearedLocalDate: last }
  }

  let current = 1
  for (let index = sortedDates.length - 1; index > 0; index -= 1) {
    const later = Date.parse(`${sortedDates[index]}T00:00:00Z`)
    const earlier = Date.parse(`${sortedDates[index - 1]}T00:00:00Z`)
    if ((later - earlier) / 86_400_000 !== 1) break
    current += 1
  }

  return { best, current, lastClearedLocalDate: last }
}

export function localDateForInstant(instant: Date, timezone: string): string {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
      day: "2-digit",
      month: "2-digit",
      timeZone: timezone,
      year: "numeric",
    })
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  )
  return `${values.year}-${values.month}-${values.day}`
}

export function localWeekBounds(
  instant: Date,
  timezone: string,
): Readonly<{ end: string; start: string; today: string }> {
  const today = localDateForInstant(instant, timezone)
  const local = new Date(`${today}T00:00:00Z`)
  const weekday = local.getUTCDay() || 7
  const shift = (days: number) => {
    const value = new Date(local)
    value.setUTCDate(value.getUTCDate() + days)
    return value.toISOString().slice(0, 10)
  }

  return {
    end: shift(7 - weekday),
    start: shift(1 - weekday),
    today,
  }
}
