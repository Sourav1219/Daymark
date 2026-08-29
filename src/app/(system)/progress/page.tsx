import type { Metadata } from "next"

import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { ProgressRoute } from "@/features/progression/components/progress-route"
import { localDateForInstant } from "@/features/progression/domain/progression"
import { getLocalDayWindow } from "@/features/quests/domain/today-window"
import { getUserSettings } from "@/features/reminders/queries/user-settings-query-service"

export const metadata: Metadata = { title: "Progress" }

type ProgressPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>
}>

export default async function ProgressPage({
  searchParams,
}: ProgressPageProps) {
  const access = await requireWorkspaceAccess()
  const params = await searchParams
  const requestedDate = typeof params.date === "string" ? params.date : null
  const settings = await getUserSettings(access)
  const todayDate = localDateForInstant(new Date(), settings.timezone)
  const selectedDate =
    requestedDate &&
    requestedDate <= todayDate &&
    getLocalDayWindow(requestedDate, settings.timezone)
      ? requestedDate
      : todayDate

  return (
    <ProgressRoute
      access={access}
      selectedDate={selectedDate}
      timezone={settings.timezone}
    />
  )
}
