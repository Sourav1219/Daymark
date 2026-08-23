import type { Metadata } from "next"

import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { TodayView } from "@/features/today/components/today-view"
import { parseQuestFilters } from "@/features/quests/validation/quest-validation"

export const metadata: Metadata = { title: "Home" }

type TodayPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>
}>

export default async function TodayPage({ searchParams }: TodayPageProps) {
  const access = await requireWorkspaceAccess()
  const params = await searchParams
  const filters = parseQuestFilters(params)
  const requestedDate =
    typeof params.date === "string" ? params.date : undefined
  const focusedQuestId =
    typeof params.task === "string" ? params.task : undefined

  return (
    <TodayView
      access={access}
      filters={filters}
      focusedQuestId={focusedQuestId}
      requestedDate={requestedDate}
    />
  )
}
