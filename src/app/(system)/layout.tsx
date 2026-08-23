import type { ReactNode } from "react"
import { forbidden } from "next/navigation"

import { AppShell } from "@/components/shell/app-shell"
import {
  requireUser,
  requireWorkspaceAccess,
} from "@/features/authentication/server/authorization"
import { getOnboardingStatus } from "@/features/onboarding/queries/onboarding-query-service"
import { getAuthorizedWorkspaceSummary } from "@/features/workspaces/application/get-workspace-summary"
import { readServerEnv } from "@/lib/env/server"

export const dynamic = "force-dynamic"

export default async function SystemLayout({
  children,
}: {
  children: ReactNode
}) {
  const [user, access] = await Promise.all([
    requireUser(),
    requireWorkspaceAccess(),
  ])
  const [workspace, onboarding] = await Promise.all([
    getAuthorizedWorkspaceSummary(access),
    getOnboardingStatus(access),
  ])

  if (!workspace) {
    forbidden()
  }
  const env = readServerEnv()

  return (
    <AppShell
      pushPublicKey={env.VAPID_PUBLIC_KEY ?? null}
      userId={access.userId}
      userName={user.name}
      onboarding={onboarding}
      workspaceName={workspace.name}
      workspaceId={access.workspaceId}
    >
      {children}
    </AppShell>
  )
}
