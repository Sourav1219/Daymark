import type { Metadata } from "next"

import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { TimerRoute } from "@/features/timer/components/timer-route"
import { getTimerDashboard } from "@/features/timer/queries/timer-query-service"

export const metadata: Metadata = { title: "Timer" }

export default async function TimerPage() {
  const access = await requireWorkspaceAccess()
  const dashboard = await getTimerDashboard(access)

  return <TimerRoute initialDashboard={dashboard} />
}
