import "server-only"

import { cache } from "react"
import { headers } from "next/headers"
import { forbidden, unauthorized } from "next/navigation"
import { z } from "zod"

import { getDatabase } from "@/db/client"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { getAuth } from "@/features/authentication/server/auth"
import { provisionPersonalWorkspace } from "@/features/workspaces/application/provision-personal-workspace"
import {
  findPersonalWorkspaceAccess,
  findWorkspaceAccess,
} from "@/features/workspaces/infrastructure/workspace-access-repository"
import { observeAuthorizationDenial } from "@/lib/observability/metrics"

const getServerSession = cache(async () =>
  getAuth().api.getSession({ headers: await headers() }),
)

async function getCurrentUser() {
  const session = await getServerSession()

  return session?.user ?? null
}

export async function requireUser() {
  const user = await getCurrentUser()

  if (!user) {
    observeAuthorizationDenial("unauthenticated")
    unauthorized()
  }

  return user
}

/** The Better Auth session id for the current request, if any. */
export async function getCurrentSessionId(): Promise<string | null> {
  const session = await getServerSession()

  return session?.session.id ?? null
}

/**
 * Converts an authenticated identity and active membership into the only
 * context accepted by workspace-scoped repositories.
 *
 * If no personal workspace is found (e.g. because the provisioning hook failed
 * during sign-up), this function attempts one idempotent re-provisioning
 * before giving up. This recovers broken accounts transparently.
 */
const getRequiredWorkspaceAccess = cache(
  async function getRequiredWorkspaceAccess(
    workspaceId?: string,
  ): Promise<AccessContext> {
    const user = await requireUser()
    const database = getDatabase()

    if (workspaceId && !z.uuid().safeParse(workspaceId).success) {
      // The raw value is unvalidated input; never feed it into metric labels.
      observeAuthorizationDenial("workspace_id_invalid")
      forbidden()
    }

    const access = workspaceId
      ? await findWorkspaceAccess(database, { userId: user.id, workspaceId })
      : await findPersonalWorkspaceAccess(database, user.id)

    if (!access) {
      if (!workspaceId) {
        // Attempt idempotent recovery: re-run provisioning in case it failed
        // during registration (e.g. the after-create hook threw an error).
        try {
          await provisionPersonalWorkspace(database, {
            id: user.id,
            name: user.name,
          })
          const recovered = await findPersonalWorkspaceAccess(database, user.id)
          if (recovered) return recovered
        } catch {
          // If re-provisioning also fails, fall through to forbidden().
        }
      }
      observeAuthorizationDenial("workspace_denied", {
        requested_workspace_id: workspaceId ?? null,
        user_id: user.id,
      })
      forbidden()
    }

    return access
  },
)

export function requireWorkspaceAccess(
  workspaceId?: string,
): Promise<AccessContext> {
  return getRequiredWorkspaceAccess(workspaceId)
}
