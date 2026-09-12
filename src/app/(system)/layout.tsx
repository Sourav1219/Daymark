import type { Metadata } from "next"
import { Caveat } from "next/font/google"
import type { ReactNode } from "react"
import { forbidden } from "next/navigation"

import "@/app/styles/redesign.css"
import "@/app/styles/anime-chapter-styling.css"
import "@/app/styles/prototype-motifs.css"
import "@/app/styles/today-home-hero.css"
import "@/app/styles/support-pages.css"

import { AppShell } from "@/components/shell/app-shell"
import { SentryFeedbackWidget } from "@/components/system/sentry-feedback-widget"
import {
  requireUser,
  requireWorkspaceAccess,
} from "@/features/authentication/server/authorization"
import { getOnboardingStatus } from "@/features/onboarding/queries/onboarding-query-service"
import { getAuthorizedWorkspaceSummary } from "@/features/workspaces/application/get-workspace-summary"
import { readServerEnv } from "@/lib/env/server"

const caveat = Caveat({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-caveat",
  weight: ["400", "500", "600", "700"],
})

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

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
    <div className={caveat.variable}>
      <SentryFeedbackWidget />
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
    </div>
  )
}
