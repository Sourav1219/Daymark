import type { Metadata } from "next"

import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { GateRoute } from "@/features/gates/components/gate-route"

export const metadata: Metadata = { title: "Lists" }

export default async function GatesPage() {
  const access = await requireWorkspaceAccess()

  return <GateRoute access={access} />
}
