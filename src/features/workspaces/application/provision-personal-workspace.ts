import "server-only"

import { and, eq, isNull } from "drizzle-orm"

import type { Database } from "@/db/client"
import {
  userProgression,
  userSettings,
  workspaceMembers,
  workspaces,
} from "@/db/schema"
import { defaultTimezone } from "@/features/reminders/domain/timezone"

type NewUser = Readonly<{
  id: string
  name: string
}>

function personalWorkspaceName(name: string): string {
  const firstName = name.trim().split(/\s+/u)[0] || "Personal"

  return `${firstName.slice(0, 96)}'s Workspace`
}

/**
 * Idempotently provisions the one personal workspace owned by a user. The
 * workspace and owner membership are committed in a single transaction.
 */
export async function provisionPersonalWorkspace(
  database: Database,
  user: NewUser,
): Promise<string> {
  return database.transaction(async (transaction) => {
    const [insertedWorkspace] = await transaction
      .insert(workspaces)
      .values({
        kind: "personal",
        name: personalWorkspaceName(user.name),
        ownerUserId: user.id,
        slug: `personal-${user.id}`,
        timezone: defaultTimezone,
      })
      .onConflictDoNothing()
      .returning({ id: workspaces.id })

    const existingWorkspace = insertedWorkspace
      ? undefined
      : (
          await transaction
            .select({ id: workspaces.id })
            .from(workspaces)
            .where(
              and(
                eq(workspaces.ownerUserId, user.id),
                eq(workspaces.kind, "personal"),
                isNull(workspaces.deletedAt),
              ),
            )
            .limit(1)
        )[0]
    const workspaceId = insertedWorkspace?.id ?? existingWorkspace?.id

    if (!workspaceId) {
      throw new Error("Unable to provision the personal workspace")
    }

    await transaction
      .insert(workspaceMembers)
      .values({ role: "owner", userId: user.id, workspaceId })
      .onConflictDoNothing()

    await transaction
      .insert(userSettings)
      .values({ userId: user.id })
      .onConflictDoNothing()

    await transaction
      .insert(userProgression)
      .values({ userId: user.id, workspaceId })
      .onConflictDoNothing()

    return workspaceId
  })
}
