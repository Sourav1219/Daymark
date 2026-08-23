import type { HunterRank } from "@/features/progression/domain/progression"

export const questActivityEventTypes = [
  "quest_completed",
  "quest_reopened",
  "quest_deleted",
  "quest_restored",
  "quest_failed",
] as const

export type QuestActivityEventType = (typeof questActivityEventTypes)[number]

export type QuestActivityPayload = Readonly<{
  currentStreak: number
  priority: "critical" | "high" | "low" | "medium"
  questTitle: string
  questVersion: number
  rank: HunterRank
  rankAdvanced: boolean
  streakIncreased: boolean
  timezone: string
  totalXp: number
  xpDelta: number
}>
