import "server-only"

import type { Database } from "@/db/client"
import { failOverdueQuests } from "@/features/quests/mutations/quest-mutation-service"
import { listOverdueSweepCandidates } from "@/features/quests/repositories/quest-repository"
import { findWorkspaceAccess } from "@/features/workspaces/infrastructure/workspace-access-repository"

export type OverdueProcessorSummary = Readonly<{
  failed: number
  owners: number
  skipped: number
  xpLost: number
}>

const defaultOwnerLimit = 50

/**
 * Scheduled counterpart to the on-request sweep. Walks the owners who currently
 * hold overdue tasks and settles each one under its own access context, so a
 * background job can never cross a workspace boundary.
 *
 * @param options.now Instant treated as "now", injectable for tests.
 * @param options.ownerLimit Maximum owners handled in one run.
 */
export async function processOverdueQuests(
  database: Database,
  options: Readonly<{ now?: Date; ownerLimit?: number }> = {},
): Promise<OverdueProcessorSummary> {
  const now = options.now ?? new Date()
  const ownerLimit = Math.min(
    Math.max(1, options.ownerLimit ?? defaultOwnerLimit),
    200,
  )
  const candidates = await listOverdueSweepCandidates(database, now, ownerLimit)

  let failed = 0
  let owners = 0
  let skipped = 0
  let xpLost = 0

  for (const candidate of candidates) {
    const access = await findWorkspaceAccess(database, candidate)

    // Membership revoked since the task was created; nothing to charge.
    if (!access) {
      skipped += 1
      continue
    }

    const summary = await failOverdueQuests(database, access, now)
    if (summary.failed > 0) owners += 1
    failed += summary.failed
    xpLost += summary.xpLost
  }

  return { failed, owners, skipped, xpLost }
}
