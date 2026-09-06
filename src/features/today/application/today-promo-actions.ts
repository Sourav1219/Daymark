"use server"

import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { localDateForInstant } from "@/features/progression/domain/progression"
import { shouldShowTodayPromo } from "@/features/today/queries/today-promo-query"
import { getAuthorizedWorkspaceSummary } from "@/features/workspaces/application/get-workspace-summary"

export async function claimTodayPromoAction(): Promise<boolean> {
  const access = await requireWorkspaceAccess()
  const workspace = await getAuthorizedWorkspaceSummary(access)
  if (!workspace) return false

  const localDate = localDateForInstant(new Date(), workspace.timezone)
  return shouldShowTodayPromo(access, localDate)
}
