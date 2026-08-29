import type { Metadata } from "next"
import { Suspense } from "react"

import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { TimerRoute } from "@/features/timer/components/timer-route"
import { getTimerDashboard } from "@/features/timer/queries/timer-query-service"
import { TimerLoadingState } from "@/features/timer/components/timer-loading-state"

export const metadata: Metadata = { title: "Timer" }

export default async function TimerPage() {
  const access = await requireWorkspaceAccess()

  return (
    <Suspense fallback={<TimerLoadingState />}>
      <TimerDashboard access={access} />
    </Suspense>
  )
}

async function TimerDashboard({
  access,
}: Readonly<{
  access: Awaited<ReturnType<typeof requireWorkspaceAccess>>
}>) {
  const dashboard = await getTimerDashboard(access)

  return <TimerRoute initialDashboard={dashboard} />
}
