import type { Metadata } from "next"

import { getDatabase } from "@/db/client"
import {
  getCurrentSessionId,
  requireUser,
  requireWorkspaceAccess,
} from "@/features/authentication/server/authorization"
import { ProfileExperience } from "@/features/authentication/ui/profile-experience"
import type { SessionView } from "@/features/authentication/application/account-security-actions"
import { listActiveSessionRecords } from "@/features/authentication/repositories/session-management-repository"
import { getAuthorizedWorkspaceSummary } from "@/features/workspaces/application/get-workspace-summary"

export const metadata: Metadata = { title: "Profile" }

export default async function ProfilePage() {
  const [user, access, currentSessionId] = await Promise.all([
    requireUser(),
    requireWorkspaceAccess(),
    getCurrentSessionId(),
  ])
  const [workspace, sessionRecords] = await Promise.all([
    getAuthorizedWorkspaceSummary(access),
    listActiveSessionRecords(getDatabase(), user.id, new Date()),
  ])
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
      initialSessions={sessions}
      joined={joined}
      name={user.name}
      role={access.role}
      workspaceName={workspace?.name ?? "Personal workspace"}
    />
  )
}
