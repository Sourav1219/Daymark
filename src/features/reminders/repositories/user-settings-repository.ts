import "server-only"

import { and, eq, isNull, sql } from "drizzle-orm"

import type { DatabaseExecutor } from "@/db/client"
import { userSettings, workspaceMembers, workspaces } from "@/db/schema"
import type { AccessContext } from "@/features/authentication/authorization/access-context"

export type UserSettingsRecord = Readonly<{
  emailRemindersEnabled: boolean
  onboardingCompletedAt: Date | null
  timezone: string
  timezoneConfirmedAt: Date | null
  version: number
}>

const settingsSelection = {
  emailRemindersEnabled: userSettings.emailRemindersEnabled,
  onboardingCompletedAt: userSettings.onboardingCompletedAt,
  timezone: userSettings.timezone,
  timezoneConfirmedAt: userSettings.timezoneConfirmedAt,
  version: userSettings.version,
}

function activeSettingsAccess(
  database: DatabaseExecutor,
  access: AccessContext,
) {
  return database
    .select({ value: sql<number>`1` })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.userId, access.userId),
        eq(workspaceMembers.workspaceId, access.workspaceId),
        isNull(workspaceMembers.deletedAt),
        isNull(workspaces.deletedAt),
      ),
    )
}

export async function findUserSettingsRecord(
  database: DatabaseExecutor,
  access: AccessContext,
): Promise<UserSettingsRecord | null> {
  const [record] = await database
    .select(settingsSelection)
    .from(userSettings)
    .where(
      and(
        eq(userSettings.userId, access.userId),
        sql`exists (${activeSettingsAccess(database, access)})`,
      ),
    )
    .limit(1)

  return record ?? null
}

export async function updateUserTimezoneRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  input: Readonly<{
    expectedVersion: number
    timezone: string
  }>,
): Promise<UserSettingsRecord | null> {
  const [updated] = await database
    .update(userSettings)
    .set({
      timezone: input.timezone,
      updatedAt: new Date(),
      version: sql`${userSettings.version} + 1`,
    })
    .where(
      and(
        eq(userSettings.userId, access.userId),
        eq(userSettings.version, input.expectedVersion),
        sql`exists (${activeSettingsAccess(database, access)})`,
      ),
    )
    .returning(settingsSelection)

  if (updated) {
    await database
      .update(workspaces)
      .set({ timezone: input.timezone, updatedAt: new Date() })
      .where(
        and(
          eq(workspaces.id, access.workspaceId),
          eq(workspaces.kind, "personal"),
          eq(workspaces.ownerUserId, access.userId),
          isNull(workspaces.deletedAt),
        ),
      )
  }

  return updated ?? null
}

export async function confirmUserTimezoneRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  input: Readonly<{ expectedVersion: number; timezone: string }>,
) {
  const now = new Date()
  const [updated] = await database
    .update(userSettings)
    .set({
      timezone: input.timezone,
      timezoneConfirmedAt: now,
      updatedAt: now,
      version: sql`${userSettings.version} + 1`,
    })
    .where(
      and(
        eq(userSettings.userId, access.userId),
        eq(userSettings.version, input.expectedVersion),
        sql`exists (${activeSettingsAccess(database, access)})`,
      ),
    )
    .returning(settingsSelection)

  if (updated) {
    await database
      .update(workspaces)
      .set({ timezone: input.timezone, updatedAt: now })
      .where(
        and(
          eq(workspaces.id, access.workspaceId),
          eq(workspaces.kind, "personal"),
          eq(workspaces.ownerUserId, access.userId),
          isNull(workspaces.deletedAt),
        ),
      )
  }
  return updated ?? null
}
