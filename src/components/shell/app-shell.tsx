import type { ReactNode } from "react"

import { AppFrame } from "@/components/shell/app-frame"
import { OfflineProvider } from "@/features/offline/components/offline-provider"
import { offlineScopeKey } from "@/features/offline/domain/types"
import { AutomaticPushEnrollment } from "@/features/reminders/components/automatic-push-enrollment"
import { AutomaticTimezone } from "@/features/onboarding/components/automatic-timezone"
import { TaskCompletionCelebrationProvider } from "@/features/quests/components/task-completion-celebration-provider"
import { TimerLifecycleBoundary } from "@/features/timer/components/timer-lifecycle-boundary"
import { SessionWatcher } from "@/features/authentication/ui/session-watcher"

type AutomaticSetupStatus = Readonly<{
  timezone: string
  timezoneConfirmed: boolean
  version: number
}>

type AppShellProps = Readonly<{
  children: ReactNode
  onboarding: AutomaticSetupStatus
  pushPublicKey: string | null
  userId: string
  userName: string
  workspaceName: string
  workspaceId: string
}>

export function AppShell({
  children,
  onboarding,
  pushPublicKey,
  userId,
  userName,
  workspaceName,
  workspaceId,
}: AppShellProps) {
  return (
    <div className="app-stage">
      <OfflineProvider
        scope={{
          key: offlineScopeKey(userId, workspaceId),
          userId,
          userName,
          workspaceId,
          workspaceName,
        }}
      >
        <TaskCompletionCelebrationProvider>
          <AppFrame>{children}</AppFrame>
        </TaskCompletionCelebrationProvider>
      </OfflineProvider>

      <TimerLifecycleBoundary />

      <AutomaticTimezone
        confirmed={onboarding.timezoneConfirmed}
        timezone={onboarding.timezone}
        version={onboarding.version}
      />
      <AutomaticPushEnrollment publicKey={pushPublicKey} />
      <SessionWatcher />
    </div>
  )
}
