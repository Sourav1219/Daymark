import { Suspense } from "react"

import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { getLabelList } from "@/features/labels/queries/label-query-service"
import { localDateForInstant } from "@/features/progression/domain/progression"
import { getCurrentCompletionStreak } from "@/features/progression/queries/progression-query-service"
import { sweepOverdueQuests } from "@/features/quests/application/sweep-overdue-quests"
import { getLocalDayWindow } from "@/features/quests/domain/today-window"
import type {
  QuestListFilters,
  QuestView,
} from "@/features/quests/domain/types"
import { getQuestList } from "@/features/quests/queries/quest-query-service"
import { getUserSettings } from "@/features/reminders/queries/user-settings-query-service"
import { getReminderInbox } from "@/features/reminders/queries/reminder-query-service"
import { DailyStudyHistory } from "@/features/timer/components/daily-study-history"
import { getDailyStudyHistory } from "@/features/timer/queries/timer-query-service"
import { TodayFilters } from "@/features/today/components/today-filters"
import { TodayHeader } from "@/features/today/components/today-header"
import { DailyStudyHistoryLoading } from "@/features/today/components/today-loading-state"
import { TodayPromo } from "@/features/today/components/today-promo"
import { TodayTasks } from "@/features/today/components/today-tasks"
import { formatTodaySchedule } from "@/features/today/domain/today-time-label"
import type { TodayCard, TodaySection } from "@/features/today/types"

type TodayViewProps = Readonly<{
  access: AccessContext
  filters: QuestListFilters
  focusedQuestId?: string | undefined
  requestedDate?: string | undefined
}>

export async function TodayView({
  access,
  filters,
  focusedQuestId,
  requestedDate,
}: TodayViewProps) {
  const now = new Date()
  const settings = await getUserSettings(access)
  const todayDate = localDateForInstant(now, settings.timezone)
  const selectedDate =
    requestedDate && getLocalDayWindow(requestedDate, settings.timezone)
      ? requestedDate
      : todayDate

  if (selectedDate === todayDate) await sweepOverdueQuests(access, now)

  const [streak, quests, labels, reminderInbox] = await Promise.all([
    getCurrentCompletionStreak(access, {
      now,
      timezone: settings.timezone,
    }),
    getQuestList(access, "today", {
      filters,
      localDate: selectedDate,
      now,
    }),
    getLabelList(access),
    getReminderInbox(access, { now }),
  ])
  const timeZone = settings.timezone
  const toCard = (quest: QuestView): TodayCard => {
    const schedule = formatTodaySchedule(quest.startAt, quest.dueAt, timeZone)

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

  const historical = selectedDate < todayDate
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
    cards: (grouped.get(title) ?? []).map(toCard),
    title,
  }))
  if (completedQuests.length > 0) {
    sections.push({ cards: completedQuests.map(toCard), title: "Completed" })
  }
  if (missedQuests.length > 0) {
    sections.push({ cards: missedQuests.map(toCard), title: "Missed" })
  }

  return (
    <div className="today-page">
      <TodayHeader
        activeLabelId={filters.labelId}
        inbox={reminderInbox}
        referenceNow={now.toISOString()}
        selectedDate={selectedDate}
        streak={streak}
        todayDate={todayDate}
        timezone={timeZone}
      />
      {selectedDate === todayDate ? <TodayPromo /> : null}
      <TodayFilters
        activeLabelId={filters.labelId}
        labels={labels.map((label) => ({ id: label.id, name: label.name }))}
        selectedDate={selectedDate}
      />
      <TodayTasks
        empty={sections.length === 0}
        focusedQuestId={focusedQuestId}
        historical={historical}
        referenceNow={now.toISOString()}
        selectedDate={selectedDate}
        sections={sections}
      />
      <Suspense fallback={<DailyStudyHistoryLoading />}>
        <TodayStudyHistory
          access={access}
          selectedDate={selectedDate}
          timezone={settings.timezone}
        />
      </Suspense>
    </div>
  )
}

async function TodayStudyHistory({
  access,
  selectedDate,
  timezone,
}: Readonly<{
  access: AccessContext
  selectedDate: string
  timezone: string
}>) {
  const history = await getDailyStudyHistory(access, timezone)

  return <DailyStudyHistory history={history} selectedDate={selectedDate} />
}
