import type { QuestPriority, QuestStatus } from "@/features/quests/domain/types"

export type TodayCard = Readonly<{
  dateLabel?: string
  description?: string | null
  dueAt?: string | null
  id: string
  title: string
  version: number
  timeLabel: string
  steps: number
  priority: QuestPriority
  status: QuestStatus
}>

export type TodaySection = Readonly<{
  title: string
  cards: readonly TodayCard[]
}>
