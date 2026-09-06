import type {
  QuestPriority,
  QuestStatus,
  QuestView,
} from "@/features/quests/domain/types"
import type {
  TaskOptionalClassification,
  TaskType,
} from "@/features/quests/domain/classification"

export type HomeTypeFacet = Readonly<{
  customType: string | null
  taskType: TaskType
}>

export type HomeFacets = Readonly<{
  priorities: readonly QuestPriority[]
  types: readonly HomeTypeFacet[]
}>

export type TodayCard = TaskOptionalClassification &
  Partial<Omit<QuestView, "description">> &
  Readonly<{
    completedAt?: string | null
    deletedAt?: string | null
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

export type HomeBucket = "active" | "completed" | "missed" | "deleted"
export type HomeFilters = Readonly<{
  customType: string | null
  taskType: TaskType | "any"
  priority: QuestPriority | "any"
  labelId: string
  search?: string | undefined
}>
export type HomePage = Readonly<{
  bucket: HomeBucket
  cards: readonly TodayCard[]
  hasMore: boolean
  offset: number
}>

export type TodaySection = Readonly<{
  title: string
  cards: readonly TodayCard[]
}>

export type TodayDayView = Readonly<{
  date: string
  hasNextPage: boolean
  historical: boolean
  page: number
  sections: readonly TodaySection[]
}>
