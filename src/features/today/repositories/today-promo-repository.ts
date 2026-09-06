import "server-only"

import { and, eq, isNull, ne, or, sql } from "drizzle-orm"

import type { DatabaseExecutor } from "@/db/client"
import { userSettings, workspaceMembers, workspaces } from "@/db/schema"
import type { AccessContext } from "@/features/authentication/authorization/access-context"

export async function claimTodayPromoDisplay(
  database: DatabaseExecutor,
  access: AccessContext,
  localDate: string,
): Promise<boolean> {
  const activeWorkspaceMembership = database
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

  const [claimed] = await database
    .update(userSettings)
    .set({ todayPromoShownOn: localDate })
    .where(
      and(
        eq(userSettings.userId, access.userId),
        or(
          isNull(userSettings.todayPromoShownOn),
          ne(userSettings.todayPromoShownOn, localDate),
        ),
        sql`exists (${activeWorkspaceMembership})`,
      ),
    )
    .returning({ userId: userSettings.userId })

  return Boolean(claimed)
}
