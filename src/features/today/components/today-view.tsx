import "@/app/styles/today-page.css"
import "@/app/styles/home-classification.css"
import "@/app/styles/notifications.css"

import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { getLabelList } from "@/features/labels/queries/label-query-service"
import { localDateForInstant } from "@/features/progression/domain/progression"
import { getCurrentCompletionStreak } from "@/features/progression/queries/progression-query-service"
import { resolveTodayDate } from "@/features/quests/domain/today-window"
import type { QuestListFilters } from "@/features/quests/domain/types"
import { getReminderInbox } from "@/features/reminders/queries/reminder-query-service"
import { getDailyStudyHistory } from "@/features/timer/queries/timer-query-service"
import { HomeExperience } from "@/features/today/components/home-experience"
import { getHomePage, getHomeFacets } from "@/features/today/queries/home-query"
import { getAuthorizedWorkspaceSummary } from "@/features/workspaces/application/get-workspace-summary"

type TodayViewProps = Readonly<{
  access: AccessContext
  filters: QuestListFilters
  focusedQuestId?: string | undefined
  page?: number
  requestedDate?: string | undefined
}>

export async function TodayView({
  access,
  filters,
  focusedQuestId,
  requestedDate,
}: TodayViewProps) {
  const now = new Date()
  const workspace = await getAuthorizedWorkspaceSummary(access)
  if (!workspace) throw new Error("Workspace access is unavailable.")
  const timezone = workspace.timezone
  const todayDate = localDateForInstant(now, timezone)
  const selectedDate = resolveTodayDate(requestedDate, todayDate, timezone)
  const homeFilters = {
    taskType: "any",
    customType: null,
    priority: "any",
    labelId: filters.labelId,
  } as const
  const [streak, pages, facets, labels, inbox, history] = await Promise.all([
    getCurrentCompletionStreak(access, { now, timezone }),
    Promise.all(
      (["active", "missed", "completed"] as const).map((bucket) =>
        getHomePage(
          access,
          bucket,
          selectedDate,
          timezone,
          homeFilters,
          0,
          now,
        ),
      ),
    ),
    getHomeFacets(access, now),
    getLabelList(access),
    getReminderInbox(access, { now }),
    getDailyStudyHistory(access, timezone),
  ])

  return (
    <div className="today-page">
      <HomeExperience
        activeLabelId={filters.labelId}
        facets={facets}
        focusedQuestId={focusedQuestId}
        history={history}
        inbox={inbox}
        initialPages={pages}
        key={selectedDate}
        labels={labels.map(({ id, name }) => ({ id, name }))}
        referenceNow={now.toISOString()}
        selectedDate={selectedDate}
        streak={streak}
        timezone={timezone}
        todayDate={todayDate}
      />
    </div>
  )
}
