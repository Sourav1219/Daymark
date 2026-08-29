import "server-only"

import { getDatabase, type Database } from "@/db/client"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { authorizeQuestAccess } from "@/features/quests/authorization/quest-authorization"
import { QuestServiceError } from "@/features/quests/domain/errors"
import {
  getLocalDayWindow,
  getTodayWindow,
} from "@/features/quests/domain/today-window"
import {
  defaultQuestFilters,
  questMutationBatchLimit,
  questPageSize,
  type QuestLabelBadge,
  type QuestListFilters,
  type QuestListKind,
  type QuestView,
} from "@/features/quests/domain/types"
import {
  getQuestLabelBadges,
  listQuestParentRecords,
  listQuestRecords,
  type QuestListItem,
  type QuestListOptions,
  type QuestListSort,
} from "@/features/quests/repositories/quest-repository"
import { getAuthorizedWorkspaceSummary } from "@/features/workspaces/application/get-workspace-summary"
import { localDateForInstant } from "@/features/progression/domain/progression"

type QuestQueryOptions = Readonly<{
  database?: Database
  localDate?: string
  filters?: Partial<QuestListFilters>
  limit?: number
  now?: Date
  offset?: number
}>

type MutableListOptions = {
  -readonly [Key in keyof QuestListOptions]: QuestListOptions[Key]
}

export async function getQuestParentOptions(
  access: AccessContext,
  options: Pick<QuestQueryOptions, "database" | "limit"> = {},
) {
  authorizeQuestAccess(access)
  const database = options.database ?? getDatabase()

  return listQuestParentRecords(
    database,
    access,
    options.limit ?? questMutationBatchLimit,
  )
}

function toQuestView(
  record: QuestListItem,
  labelsByQuest: ReadonlyMap<string, readonly QuestLabelBadge[]>,
): QuestView {
  return {
    completedAt: record.completedAt?.toISOString() ?? null,
    deletedAt: record.deletedAt?.toISOString() ?? null,
    description: record.description,
    dueAt: record.dueAt?.toISOString() ?? null,
    gateName: record.gateName,
    id: record.id,
    labels: labelsByQuest.get(record.id) ?? [],
    parentTaskId: record.parentTaskId,
    position: record.position,
    priority: record.priority,
    projectId: record.projectId,
    recurrenceOccurrenceAt:
      record.recurrenceOccurrenceAt?.toISOString() ?? null,
    recurrenceRule: record.recurrenceRule,
    recurrenceSequence: record.recurrenceSequence,
    recurrenceSeriesId: record.recurrenceSeriesId,
    recurrenceTimezone: record.recurrenceTimezone,
    startAt: record.startAt?.toISOString() ?? null,
    status: record.status,
    subquestCount: record.subquestCount,
    title: record.title,
    version: record.version,
  }
}

export async function getQuestList(
  access: AccessContext,
  kind: QuestListKind,
  options: QuestQueryOptions = {},
): Promise<readonly QuestView[]> {
  authorizeQuestAccess(access)
  const database = options.database ?? getDatabase()
  const filters: QuestListFilters = {
    ...defaultQuestFilters,
    ...options.filters,
  }
  const now = options.now ?? new Date()

  const listOptions: MutableListOptions = {
    limit: options.limit ?? questPageSize,
    offset: options.offset ?? 0,
    now,
  }

  if (filters.priority !== "any") {
    listOptions.priority = filters.priority
  }

  if (filters.gateId === "none") {
    listOptions.noGate = true
  } else if (filters.gateId !== "any") {
    listOptions.gateId = filters.gateId
  }

  if (filters.labelId !== "any") {
    listOptions.labelId = filters.labelId
  }

  if (filters.search) {
    listOptions.search = filters.search
  }

  if (filters.sort !== "manual") {
    listOptions.sort = filters.sort satisfies QuestListSort
  }

  const needsDayWindow =
    kind === "today" || filters.due === "today" || filters.due === "upcoming"
  const needsWorkspaceCalendar = needsDayWindow

  if (needsWorkspaceCalendar) {
    const workspace = await getAuthorizedWorkspaceSummary(access, database)

    if (!workspace) {
      throw new QuestServiceError(
        "FORBIDDEN",
        "Workspace access is no longer active.",
      )
    }

    const window =
      needsDayWindow && options.localDate
        ? getLocalDayWindow(options.localDate, workspace.timezone)
        : getTodayWindow(now, workspace.timezone)

    if (!window) {
      throw new QuestServiceError(
        "VALIDATION_ERROR",
        "Choose a valid calendar date.",
      )
    }

    if (kind === "today") {
      listOptions.dayEnd = window.end
      listOptions.dayStart = window.start
      const currentWorkspaceDay =
        !options.localDate ||
        options.localDate === localDateForInstant(now, workspace.timezone)
      listOptions.includeUnscheduledForDay = currentWorkspaceDay
    }

    if (filters.due === "today") {
      listOptions.dueAfter = window.start
      listOptions.dueBefore = window.end
    }

    if (filters.due === "upcoming") {
      listOptions.dueAfter = window.end
    }
  }

  if (filters.due === "overdue") {
    listOptions.dueBefore = now
  }

  if (filters.due === "none") {
    listOptions.dueIsNull = true
  }

  // Status narrowing only applies to the All Quests view; the Today,
  // Cleared and Deleted views own their lifecycle rules.
  if (kind === "active") {
    listOptions.status = filters.status
  }

  const records = await listQuestRecords(database, access, kind, listOptions)
  const labelsByQuest = await getQuestLabelBadges(
    database,
    access,
    records.map((record) => record.id),
  )

  return records.map((record) => toQuestView(record, labelsByQuest))
}

export async function getQuestRecoveryBoard(
  access: AccessContext,
  options: QuestQueryOptions = {},
) {
  const [active, deleted] = await Promise.all([
    getQuestList(access, "active", options),
    getQuestList(access, "deleted", options),
  ])

  return { active, deleted } as const
}
