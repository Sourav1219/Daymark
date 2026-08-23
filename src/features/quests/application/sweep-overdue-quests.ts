import "server-only"

import { getDatabase } from "@/db/client"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import {
  failOverdueQuests,
  type OverdueSweepSummary,
} from "@/features/quests/mutations/quest-mutation-service"

const emptySummary: OverdueSweepSummary = { failed: 0, xpLost: 0 }

/**
 * Settles overdue tasks on behalf of the signed-in member, for use from read
 * paths that render the task lists. Deployments also run this on a schedule via
 * the cron route; this call is what makes a missed task settle immediately when
 * the owner opens the app rather than waiting for the next scheduled run.
 *
 * Never throws: a page must still render if the sweep cannot complete.
 */
export async function sweepOverdueQuests(
  access: AccessContext,
  now?: Date,
): Promise<OverdueSweepSummary> {
  try {
    return await failOverdueQuests(getDatabase(), access, now)
  } catch (error) {
    console.error("Overdue task sweep incident", {
      name: error instanceof Error ? error.name : typeof error,
    })

    return emptySummary
  }
}
