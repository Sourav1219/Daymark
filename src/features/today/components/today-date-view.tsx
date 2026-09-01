"use client"

import { useState } from "react"

import { QuestPagination } from "@/features/quests/components/quest-pagination"
import type { ReminderInboxData } from "@/features/reminders/domain/types"
import { DailyStudyHistory } from "@/features/timer/components/daily-study-history"
import type { DailyStudySummaryView } from "@/features/timer/domain/types"
import { TodayFilters } from "@/features/today/components/today-filters"
import { TodayHeader } from "@/features/today/components/today-header"
import { TodayPromo } from "@/features/today/components/today-promo"
import { TodayTasks } from "@/features/today/components/today-tasks"
import type { TodayDayView } from "@/features/today/types"

type TodayDateViewProps = Readonly<{
  activeLabelId: string
  days: readonly TodayDayView[]
  focusedQuestId?: string | undefined
  history: readonly DailyStudySummaryView[]
  inbox: ReminderInboxData
  labels: readonly Readonly<{ id: string; name: string }>[]
  referenceNow: string
  selectedDate: string
  streak: number
  timezone: string
  todayDate: string
}>

export function TodayDateView({
  activeLabelId,
  days,
  focusedQuestId,
  history,
  inbox,
  labels,
  referenceNow,
  selectedDate,
  streak,
  timezone,
  todayDate,
}: TodayDateViewProps) {
  const [visibleDate, setVisibleDate] = useState(selectedDate)
  const selectedDay =
    days.find(({ date }) => date === visibleDate) ??
    days.find(({ date }) => date === selectedDate)

  if (!selectedDay) return null

  function showPreloadedDate(date: string) {
    if (days.some((day) => day.date === date)) setVisibleDate(date)
  }

  return (
    <>
      <TodayHeader
        activeLabelId={activeLabelId}
        inbox={inbox}
        onDateNavigate={showPreloadedDate}
        referenceNow={referenceNow}
        selectedDate={visibleDate}
        streak={streak}
        todayDate={todayDate}
        timezone={timezone}
      />
      {visibleDate === todayDate ? <TodayPromo /> : null}
      <TodayFilters
        activeLabelId={activeLabelId}
        labels={labels}
        selectedDate={visibleDate}
      />
      <TodayTasks
        empty={selectedDay.sections.length === 0}
        focusedQuestId={
          visibleDate === selectedDate ? focusedQuestId : undefined
        }
        historical={selectedDay.historical}
        referenceNow={referenceNow}
        selectedDate={visibleDate}
        sections={selectedDay.sections}
      />
      <QuestPagination
        hasNextPage={selectedDay.hasNextPage}
        page={selectedDay.page}
      />
      <DailyStudyHistory history={history} selectedDate={visibleDate} />
    </>
  )
}
