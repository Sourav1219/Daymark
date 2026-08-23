import { forbidden } from "next/navigation"

import { PageHeading } from "@/components/system/page-heading"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { getAuthorizedWorkspaceSummary } from "@/features/workspaces/application/get-workspace-summary"

type WorkspacePageProps = Readonly<{
  params: Promise<{ workspaceId: string }>
}>

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { workspaceId } = await params
  const access = await requireWorkspaceAccess(workspaceId)
  const workspace = await getAuthorizedWorkspaceSummary(access)

  if (!workspace) {
    forbidden()
  }

  return (
    <div className="grid gap-section">
      <PageHeading
        actions={<Badge variant="outline">{access.role}</Badge>}
        description="The explicit workspace URL passed the same membership-predicated access boundary used by every shell route."
        eyebrow="Authorized workspace"
        title={workspace.name}
      />
      <Card className="border-border-soft bg-card/72 shadow-panel">
        <CardContent className="p-panel text-sm leading-7 text-ink-muted">
          This route remains an authorization diagnostic only. Phase 3 adds no
          workspace mutation or task functionality.
        </CardContent>
      </Card>
    </div>
  )
}
