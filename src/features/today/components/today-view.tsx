import "@/app/styles/today-page.css"

import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { getLabelList } from "@/features/labels/queries/label-query-service"
import { localDateForInstant } from "@/features/progression/domain/progression"
import { getCurrentCompletionStreak } from "@/features/progression/queries/progression-query-service"
import {
  getLocalDayWindow,
  resolveTodayDate,
} from "@/features/quests/domain/today-window"
import {
  questMutationBatchLimit,
  questPageSize,
  type QuestListFilters,
  type QuestView,
} from "@/features/quests/domain/types"
import { getQuestList } from "@/features/quests/queries/quest-query-service"
import { getReminderInbox } from "@/features/reminders/queries/reminder-query-service"
import { getDailyStudyHistory } from "@/features/timer/queries/timer-query-service"
import { TodayDateView } from "@/features/today/components/today-date-view"
import { formatTodaySchedule } from "@/features/today/domain/today-time-label"
import type {
  TodayCard,
  TodayDayView,
  TodaySection,
} from "@/features/today/types"
import { getAuthorizedWorkspaceSummary } from "@/features/workspaces/application/get-workspace-summary"

type TodayViewProps = Readonly<{
  access: AccessContext
  filters: QuestListFilters
  focusedQuestId?: string | undefined
  page?: number
  requestedDate?: string | undefined
}>

const navigationWindowDays = 21

function utcDate(value: string): Date {
  return new Date(`${value}T12:00:00Z`)
}

function addDays(value: string, amount: number): string {
  const date = utcDate(value)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function navigationDates(selectedDate: string): readonly string[] {
  const weekStart = addDays(selectedDate, -utcDate(selectedDate).getUTCDay())
  const preloadStart = addDays(weekStart, -7)

  return Array.from({ length: navigationWindowDays }, (_, index) =>
    addDays(preloadStart, index),
  )
}

function isWithinWindow(value: string | null, start: number, end: number) {
  if (!value) return false
  const instant = new Date(value).getTime()
  return instant >= start && instant < end
}

function questAppearsOnDate(
  quest: QuestView,
  date: string,
  todayDate: string,
  timezone: string,
) {
  const window = getLocalDayWindow(date, timezone)
  if (!window) return false

  const start = window.start.getTime()
  const end = window.end.getTime()
  const historical = date < todayDate

  if (quest.status === "completed") {
    return historical && isWithinWindow(quest.completedAt, start, end)
  }

  if (quest.status === "failed") {
    return isWithinWindow(quest.dueAt, start, end)
  }

  if (historical) return false

  if (quest.startAt) {
    const startsBeforeEnd = new Date(quest.startAt).getTime() < end
    const endsAfterStart =
      !quest.dueAt || new Date(quest.dueAt).getTime() >= start
    return startsBeforeEnd && endsAfterStart
  }

  return quest.dueAt
    ? isWithinWindow(quest.dueAt, start, end)
    : date === todayDate
}

function toTodayCard(quest: QuestView, timezone: string): TodayCard {
  const schedule = formatTodaySchedule(quest.startAt, quest.dueAt, timezone)

  return {
    dateLabel: schedule.dateLabel,
    description: quest.description,
    dueAt: quest.dueAt,
    id: quest.id,
    priority: quest.priority,
    status: quest.status,
    steps: quest.subquestCount,
    timeLabel: schedule.timeLabel,
    title: quest.title,
    version: quest.version,
  }
}

function buildSections(
  quests: readonly QuestView[],
  historical: boolean,
  timezone: string,
): TodaySection[] {
  const openQuests = historical
    ? []
    : quests.filter(({ status }) => status === "open")
  const completedQuests = historical
    ? quests.filter(({ status }) => status === "completed")
    : []
  const missedQuests = quests.filter(({ status }) => status === "failed")
  const order: string[] = []
  const grouped = new Map<string, QuestView[]>()

  for (const quest of openQuests) {
    const key = quest.gateName ?? "My tasks"
    const bucket = grouped.get(key)
    if (bucket) {
      bucket.push(quest)
    } else {
      grouped.set(key, [quest])
      order.push(key)
    }
  }

  const sections: TodaySection[] = order.map((title) => ({
    cards: (grouped.get(title) ?? []).map((quest) =>
      toTodayCard(quest, timezone),
    ),
    title,
  }))
  if (completedQuests.length > 0) {
    sections.push({
      cards: completedQuests.map((quest) => toTodayCard(quest, timezone)),
      title: "Completed",
    })
  }
  if (missedQuests.length > 0) {
    sections.push({
      cards: missedQuests.map((quest) => toTodayCard(quest, timezone)),
      title: "Missed",
    })
  }

  return sections
}

function buildDayView(
  date: string,
  quests: readonly QuestView[],
  requestedPage: number,
  todayDate: string,
  timezone: string,
): TodayDayView {
  const matchingQuests = quests.filter((quest) =>
    questAppearsOnDate(quest, date, todayDate, timezone),
  )
  const offset = (requestedPage - 1) * questPageSize
  const pageQuests = matchingQuests.slice(offset, offset + questPageSize)

  return {
    date,
    hasNextPage: matchingQuests.length > offset + questPageSize,
    historical: date < todayDate,
    page: requestedPage,
    sections: buildSections(pageQuests, date < todayDate, timezone),
  }
}

export async function TodayView({
  access,
  filters,
  focusedQuestId,
  page = 1,
  requestedDate,
}: TodayViewProps) {
  const now = new Date()
  const labelsPromise = getLabelList(access)
  const reminderInboxPromise = getReminderInbox(access, { now })
  const workspace = await getAuthorizedWorkspaceSummary(access)
  if (!workspace) throw new Error("Workspace access is unavailable.")

  const timezone = workspace.timezone
  const todayDate = localDateForInstant(now, timezone)
  const selectedDate = resolveTodayDate(requestedDate, todayDate, timezone)
  const dates = navigationDates(selectedDate)

  const [streak, quests, labels, reminderInbox, history] = await Promise.all([
    getCurrentCompletionStreak(access, { now, timezone }),
    getQuestList(access, "today", {
      filters,
      includeLabelBadges: false,
      limit: questMutationBatchLimit,
      localDateRange: {
        end: dates.at(-1) ?? selectedDate,
        start: dates[0] ?? selectedDate,
      },
      now,
    }),
    labelsPromise,
    reminderInboxPromise,
    getDailyStudyHistory(access, timezone),
  ])
  const days = dates.map((date) =>
    buildDayView(
      date,
      quests,
      date === selectedDate ? page : 1,
      todayDate,
      timezone,
    ),
  )

  return (
    <div className="today-page">
      <TodayDateView
        activeLabelId={filters.labelId}
        days={days}
        focusedQuestId={focusedQuestId}
        history={history}
        inbox={reminderInbox}
        key={selectedDate}
        labels={labels.map((label) => ({ id: label.id, name: label.name }))}
        referenceNow={now.toISOString()}
        selectedDate={selectedDate}
        streak={streak}
        timezone={timezone}
        todayDate={todayDate}
      />
    </div>
  )
}
