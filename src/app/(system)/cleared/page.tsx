import type { Metadata } from "next"
import { Suspense } from "react"

import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { QuestRoute } from "@/features/quests/components/quest-route"
import { parseQuestFilters } from "@/features/quests/validation/quest-validation"
import { parseQuestPage } from "@/features/quests/domain/types"
import { QuestLoadingState } from "@/features/quests/components/quest-loading-state"

export const metadata: Metadata = { title: "Cleared" }

type ClearedPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>
}>

export default async function ClearedPage({ searchParams }: ClearedPageProps) {
  const access = await requireWorkspaceAccess()
  const params = await searchParams
  const filters = parseQuestFilters(params)

  return (
    <Suspense fallback={<QuestLoadingState mode="cleared" />}>
      <QuestRoute
        access={access}
        filters={filters}
        kind="cleared"
        page={parseQuestPage(params.page)}
      />
    </Suspense>
  )
}
