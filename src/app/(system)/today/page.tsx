import type { Metadata } from "next"
import { Suspense } from "react"

import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { TodayView } from "@/features/today/components/today-view"
import { parseQuestFilters } from "@/features/quests/validation/quest-validation"
import { parseQuestPage } from "@/features/quests/domain/types"
import { TodayLoadingState } from "@/features/today/components/today-loading-state"

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
    <Suspense fallback={<TodayLoadingState />}>
      <TodayView
        access={access}
        filters={filters}
        focusedQuestId={focusedQuestId}
        page={parseQuestPage(params.page)}
        requestedDate={requestedDate}
      />
    </Suspense>
  )
}
