import "server-only"

import { getDatabase, type Database } from "@/db/client"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import {
  getWorkspaceSummary,
  type WorkspaceSummary,
} from "@/features/workspaces/infrastructure/workspace-access-repository"

/** Authenticated query service for workspace presentation models. */
export function getAuthorizedWorkspaceSummary(
  access: AccessContext,
  database: Database = getDatabase(),
): Promise<WorkspaceSummary | null> {
  return getWorkspaceSummary(database, access)
}
