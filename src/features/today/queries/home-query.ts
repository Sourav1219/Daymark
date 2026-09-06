import "server-only"

import { getDatabase } from "@/db/client"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { authorizeQuestAccess } from "@/features/quests/authorization/quest-authorization"
import { getLocalDayWindow } from "@/features/quests/domain/today-window"
import { localDateForInstant } from "@/features/progression/domain/progression"
import {
  listQuestPriorityFacets,
  listQuestRecords,
  listQuestTypeFacets,
  type QuestListOptions,
} from "@/features/quests/repositories/quest-repository"
import { taskTypes } from "@/features/quests/domain/classification"
import { questPriorities } from "@/features/quests/domain/types"
import { toQuestView } from "@/features/quests/queries/quest-query-service"
import { formatTodaySchedule } from "@/features/today/domain/today-time-label"
import type {
  HomeBucket,
  HomeFilters,
  HomePage,
  TodayCard,
} from "@/features/today/types"
import type { QuestListKind } from "@/features/quests/domain/types"

export const homePageSize = 20

function homeOptions(
  bucket: HomeBucket,
  date: string,
  timezone: string,
  filters: HomeFilters,
  now: Date,
): { kind: QuestListKind; options: QuestListOptions } {
  const window = getLocalDayWindow(date, timezone)
  if (!window) throw new Error("Choose a valid date.")
  const today = localDateForInstant(now, timezone)
  const isSearching = Boolean(filters.search?.trim())
  const options: QuestListOptions = {
    now,
    ...(filters.taskType !== "any" ? { taskType: filters.taskType } : {}),
    ...(filters.taskType === "custom"
      ? { customType: filters.customType }
      : {}),
    ...(filters.priority !== "any" ? { priority: filters.priority } : {}),
    ...(filters.labelId !== "any" ? { labelId: filters.labelId } : {}),
    ...(isSearching ? { search: filters.search } : {}),
  }
  if (bucket === "active")
    return {
      kind: "active",
      options: {
        ...options,
        status: "open",
        ...(isSearching
          ? {}
          : {
              dayStart: window.start,
              dayEnd: window.end,
              includeUnscheduledForDay: date === today,
            }),
      },
    }
  if (bucket === "completed")
    return {
      kind: "cleared",
      options: {
        ...options,
        ...(isSearching
          ? {}
          : {
              completedAfter: window.start,
              completedBefore: window.end,
            }),
        sort: "recently-completed",
      },
    }
  if (bucket === "missed")
    return {
      kind: "active",
      options: {
        ...options,
        status: "failed",
        ...(isSearching
          ? {}
          : {
              dueAfter: window.start,
              dueBefore: window.end,
            }),
        sort: "due-latest",
      },
    }
  return {
    kind: "deleted",
    options: {
      ...options,
      ...(isSearching
        ? {}
        : {
            deletedAfter: window.start,
            deletedBefore: window.end,
          }),
      sort: "recently-deleted",
    },
  }
}

export async function getHomePage(
  access: AccessContext,
  bucket: HomeBucket,
  date: string,
  timezone: string,
  filters: HomeFilters,
  offset = 0,
  now = new Date(),
): Promise<HomePage> {
  authorizeQuestAccess(access)
  const isSearching = Boolean(filters.search?.trim())
  if (
    bucket === "active" &&
    date < localDateForInstant(now, timezone) &&
    !isSearching
  )
    return { bucket, cards: [], hasMore: false, offset: 0 }
  const { kind, options } = homeOptions(bucket, date, timezone, filters, now)
  const records = await listQuestRecords(getDatabase(), access, kind, {
    ...options,
    limit: homePageSize + 1,
    offset,
  })
  const cards: TodayCard[] = records.slice(0, homePageSize).map((record) => {
    const quest = toQuestView(record, new Map())
    const schedule = formatTodaySchedule(quest.startAt, quest.dueAt, timezone)
    return { ...quest, ...schedule, steps: quest.subquestCount }
  })
  return {
    bucket,
    cards,
    hasMore: records.length > homePageSize,
    offset: offset + cards.length,
  }
}

export async function getHomeFacets(access: AccessContext, now = new Date()) {
  authorizeQuestAccess(access)
  const options = { now, status: "open" } as const
  const [typeFacets, priorityFacets] = await Promise.all([
    listQuestTypeFacets(getDatabase(), access, "active", options),
    listQuestPriorityFacets(getDatabase(), access, "active", options),
  ])
  const uniqueTypes = new Map(
    typeFacets
      .filter((facet) => taskTypes.includes(facet.taskType))
      .map((facet) => [`${facet.taskType}:${facet.customType ?? ""}`, facet]),
  )
  const typeOrder = new Map(taskTypes.map((type, index) => [type, index]))
  const types = [...uniqueTypes.values()].sort(
    (left, right) =>
      (typeOrder.get(left.taskType) ?? taskTypes.length) -
        (typeOrder.get(right.taskType) ?? taskTypes.length) ||
      (left.customType ?? "").localeCompare(right.customType ?? ""),
  )
  const presentPriorities = new Set(priorityFacets)

  return {
    priorities: questPriorities.filter((priority) =>
      presentPriorities.has(priority),
    ),
    types,
  }
}
