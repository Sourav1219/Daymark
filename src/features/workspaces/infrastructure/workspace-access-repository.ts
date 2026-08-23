import "server-only"

import { and, eq, isNull } from "drizzle-orm"

import type { Database, DatabaseExecutor } from "@/db/client"
import { workspaceMembers, workspaces } from "@/db/schema"
import type { AccessContext } from "@/features/authentication/authorization/access-context"

export type WorkspaceSummary = Readonly<{
  id: string
  name: string
  slug: string
  timezone: string
}>

type AccessLookup = Readonly<{
  userId: string
  workspaceId: string
}>

const activeAccessPredicate = ({ userId, workspaceId }: AccessLookup) =>
  and(
    eq(workspaceMembers.userId, userId),
    eq(workspaceMembers.workspaceId, workspaceId),
    isNull(workspaceMembers.deletedAt),
    eq(workspaces.id, workspaceId),
    isNull(workspaces.deletedAt),
  )

/**
 * Authorization-boundary lookup. This is the only repository operation allowed
 * to create an AccessContext from an authenticated user and requested workspace.
 */
export async function findWorkspaceAccess(
  database: Database,
  lookup: AccessLookup,
): Promise<AccessContext | null> {
  const [membership] = await database
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(activeAccessPredicate(lookup))
    .limit(1)

  return membership ? { ...lookup, role: membership.role } : null
}

/**
 * Authorization-boundary lookup used when no workspace is named in the URL.
 */
export async function findPersonalWorkspaceAccess(
  database: Database,
  userId: string,
): Promise<AccessContext | null> {
  const [membership] = await database
    .select({
      role: workspaceMembers.role,
      workspaceId: workspaceMembers.workspaceId,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaces.ownerUserId, userId),
        eq(workspaces.kind, "personal"),
        isNull(workspaceMembers.deletedAt),
        isNull(workspaces.deletedAt),
      ),
    )
    .limit(1)

  return membership
    ? { userId, workspaceId: membership.workspaceId, role: membership.role }
    : null
}

/** Every workspace-scoped read receives and re-applies the AccessContext. */
export async function getWorkspaceSummary(
  database: Database,
  access: AccessContext,
): Promise<WorkspaceSummary | null> {
  const [workspace] = await database
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      timezone: workspaces.timezone,
    })
    .from(workspaces)
    .innerJoin(
      workspaceMembers,
      eq(workspaceMembers.workspaceId, workspaces.id),
    )
    .where(activeAccessPredicate(access))
    .limit(1)

  return workspace ?? null
}

/**
 * Serializes aggregate mutations inside one workspace and re-checks the
 * authoritative membership before the caller reads related records.
 */
export async function lockWorkspaceForMutation(
  database: DatabaseExecutor,
  access: AccessContext,
): Promise<boolean> {
  const [workspace] = await database
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(
      workspaceMembers,
      eq(workspaceMembers.workspaceId, workspaces.id),
    )
    .where(activeAccessPredicate(access))
    .for("update", { of: workspaces })
    .limit(1)

  return Boolean(workspace)
}
