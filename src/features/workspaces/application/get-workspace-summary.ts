import "server-only"

import { cache } from "react"

import { getDatabase, type Database } from "@/db/client"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import {
  getWorkspaceSummary,
  type WorkspaceSummary,
} from "@/features/workspaces/infrastructure/workspace-access-repository"

/** Authenticated query service for workspace presentation models. */
const getCachedWorkspaceSummary = cache(function getCachedWorkspaceSummary(
  access: AccessContext,
  database: Database,
): Promise<WorkspaceSummary | null> {
  return getWorkspaceSummary(database, access)
})

export function getAuthorizedWorkspaceSummary(
  access: AccessContext,
  database: Database = getDatabase(),
): Promise<WorkspaceSummary | null> {
  return getCachedWorkspaceSummary(access, database)
}
