import type { Metadata } from "next"

import { getDatabase } from "@/db/client"
import {
  getCurrentSessionId,
  requireUser,
  requireWorkspaceAccess,
} from "@/features/authentication/server/authorization"
import { ProfileExperience } from "@/features/authentication/ui/profile-experience"
import type { SessionView } from "@/features/authentication/application/account-security-actions"
import { and, eq, isNotNull } from "drizzle-orm"
import { accounts } from "@/db/schema"
import { listActiveSessionRecords } from "@/features/authentication/repositories/session-management-repository"
import { getAuthorizedWorkspaceSummary } from "@/features/workspaces/application/get-workspace-summary"

export const metadata: Metadata = { title: "Profile" }

export default async function ProfilePage() {
  const [user, access, currentSessionId] = await Promise.all([
    requireUser(),
    requireWorkspaceAccess(),
    getCurrentSessionId(),
  ])
  const database = getDatabase()
  const [workspace, sessionRecords, credentialAccounts] = await Promise.all([
    getAuthorizedWorkspaceSummary(access),
    listActiveSessionRecords(database, user.id, new Date()),
    database
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, user.id), isNotNull(accounts.password)))
      .limit(1),
  ])
  const hasPassword = credentialAccounts.length > 0
  const sessions: readonly SessionView[] = sessionRecords.map((record) => ({
    createdAt: record.createdAt.toISOString(),
    expiresAt: record.expiresAt.toISOString(),
    id: record.id,
    ipAddress: record.ipAddress,
    userAgent: record.userAgent,
  }))
  const joined = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(user.createdAt)

  return (
    <ProfileExperience
      currentSessionId={currentSessionId}
      email={user.email}
      hasPassword={hasPassword}
      initialSessions={sessions}
      joined={joined}
      name={user.name}
      role={access.role}
      workspaceName={workspace?.name ?? "Personal workspace"}
    />
  )
}
