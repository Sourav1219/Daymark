export const questPriorities = ["low", "medium", "high", "critical"] as const

/**
 * "failed" is a terminal state applied automatically once a task's due time
 * passes while it is still open. Failed tasks stay visible so the owner can
 * review and delete them; the XP penalty is not refunded on deletion.
 */
export const questStatuses = ["open", "completed", "failed"] as const

export type QuestStatus = (typeof questStatuses)[number]
export type QuestPriority = (typeof questPriorities)[number]

export type QuestLabelBadge = Readonly<{
  id: string
  name: string
  colorToken: string
}>

export type QuestView = Readonly<{
  id: string
  title: string
  description: string
  status: QuestStatus
  priority: QuestPriority
  position: number
  startAt: string | null
  dueAt: string | null
  recurrenceOccurrenceAt: string | null
  recurrenceRule: string | null
  recurrenceSequence: number | null
  recurrenceSeriesId: string | null
  recurrenceTimezone: string | null
  completedAt: string | null
  deletedAt: string | null
  version: number
  projectId: string | null
  parentTaskId: string | null
  gateName: string | null
  subquestCount: number
  labels: readonly QuestLabelBadge[]
}>

export type QuestListKind = "active" | "cleared" | "deleted" | "today"

export const questSortOptions = [
  "manual",
  "due-soonest",
  "due-latest",
  "priority",
  "recently-updated",
] as const
type QuestSortOption = (typeof questSortOptions)[number]

export const questDueDateFilters = [
  "any",
  "overdue",
  "today",
  "upcoming",
  "none",
] as const
type QuestDueDateFilter = (typeof questDueDateFilters)[number]

export const questStatusFilters = [
  "open",
  "completed",
  "failed",
  "all",
] as const
type QuestStatusFilter = (typeof questStatusFilters)[number]

export type QuestListFilters = Readonly<{
  search: string
  status: QuestStatusFilter
  priority: QuestPriority | "any"
  /** "any", "none" (ungated), or a Gate UUID */
  gateId: string
  /** "any" or a Label UUID */
  labelId: string
  due: QuestDueDateFilter
  sort: QuestSortOption
}>

export const defaultQuestFilters: QuestListFilters = {
  due: "any",
  gateId: "any",
  labelId: "any",
  priority: "any",
  search: "",
  sort: "manual",
  status: "open",
}

/** Hard cap applied by server-side query services to keep list queries bounded. */
export const questListLimit = 200

export function isQuestFiltered(filters: QuestListFilters): boolean {
  return (
    filters.search !== defaultQuestFilters.search ||
    filters.status !== defaultQuestFilters.status ||
    filters.priority !== defaultQuestFilters.priority ||
    filters.gateId !== defaultQuestFilters.gateId ||
    filters.labelId !== defaultQuestFilters.labelId ||
    filters.due !== defaultQuestFilters.due ||
    filters.sort !== defaultQuestFilters.sort
  )
}
