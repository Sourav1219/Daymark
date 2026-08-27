"use client"

import { Suspense } from "react"
import { usePathname } from "next/navigation"

import { BottomTabBar } from "@/components/shell/bottom-tab-bar"
import {
  ContactLoadingState,
  GatesLoadingState,
  LabelsLoadingState,
  SettingsLoadingState,
  WorkspaceLoadingState,
} from "@/components/system/management-loading-states"
import { PageSkeleton } from "@/components/system/page-skeleton"
import { ProfileLoadingState } from "@/features/authentication/ui/profile-loading-state"
import { ProgressLoadingState } from "@/features/progression/components/progress-loading-state"
import { QuestLoadingState } from "@/features/quests/components/quest-loading-state"
import { TimerLoadingState } from "@/features/timer/components/timer-loading-state"
import { TodayLoadingState } from "@/features/today/components/today-loading-state"

const publicRoutes = new Set([
  "/",
  "/about",
  "/forgot-password",
  "/privacy",
  "/reset-password",
  "/sign-in",
  "/sign-up",
  "/terms",
  "/verify-email",
  "/~offline",
])

export function SystemRouteLoadingState() {
  const pathname = usePathname()

  if (pathname.startsWith("/today")) return <TodayLoadingState />
  if (pathname.startsWith("/quests")) return <QuestLoadingState />
  if (pathname.startsWith("/cleared"))
    return <QuestLoadingState mode="cleared" />
  if (pathname.startsWith("/timer")) return <TimerLoadingState />
  if (pathname.startsWith("/progress")) return <ProgressLoadingState />
  if (pathname.startsWith("/profile")) return <ProfileLoadingState />
  if (pathname.startsWith("/settings")) return <SettingsLoadingState />
  if (pathname.startsWith("/gates")) return <GatesLoadingState />
  if (pathname.startsWith("/labels")) return <LabelsLoadingState />
  if (pathname.startsWith("/contact")) return <ContactLoadingState />
  if (pathname.startsWith("/app/workspaces")) return <WorkspaceLoadingState />

  return <PageSkeleton />
}

export function RouteLoadingScreen() {
  const pathname = usePathname()

  if (publicRoutes.has(pathname)) {
    return <PublicRouteLoading pathname={pathname} />
  }

  return (
    <div className="app-stage">
      <div className="device-frame" id="app-device-viewport">
        <div className="device-main-viewport">
          <main className="device-main" id="main-content">
            <SystemRouteLoadingState />
          </main>
          <span aria-hidden="true" className="device-scroll-indicator" />
        </div>
        <BottomTabBar />
      </div>
    </div>
  )
}

export function RootRouteLoadingScreen() {
  return (
    <Suspense fallback={<NeutralRouteLoadingScreen />}>
      <RouteLoadingScreen />
    </Suspense>
  )
}

function NeutralRouteLoadingScreen() {
  return (
    <div className="app-stage">
      <div className="device-frame">
        <main className="device-main">
          <PageSkeleton />
        </main>
      </div>
    </div>
  )
}

function PublicRouteLoading({ pathname }: Readonly<{ pathname: string }>) {
  const label = pathname.includes("sign")
    ? "Opening your account"
    : pathname === "/"
      ? "Opening Traketo"
      : "Opening page"

  return (
    <main aria-label={label} className="public-route-loading" role="status">
      <span aria-hidden="true" className="public-route-loading__mark">
        T
      </span>
      <strong>Traketo</strong>
      <p>{label}</p>
    </main>
  )
}
