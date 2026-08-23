import type { Metadata } from "next"

import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { QuestRoute } from "@/features/quests/components/quest-route"
import { parseQuestFilters } from "@/features/quests/validation/quest-validation"

export const metadata: Metadata = { title: "Cleared" }

type ClearedPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>
}>

export default async function ClearedPage({ searchParams }: ClearedPageProps) {
  const access = await requireWorkspaceAccess()
  const filters = parseQuestFilters(await searchParams)

  return <QuestRoute access={access} filters={filters} kind="cleared" />
}
