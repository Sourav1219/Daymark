import type { Metadata } from "next"

import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { LabelRoute } from "@/features/labels/components/label-route"

export const metadata: Metadata = { title: "Labels" }

export default async function LabelsPage() {
  const access = await requireWorkspaceAccess()

  return <LabelRoute access={access} />
}
