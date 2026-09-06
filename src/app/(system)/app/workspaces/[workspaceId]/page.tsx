import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { forbidden } from "next/navigation"

import { PageHeading } from "@/components/system/page-heading"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
        description="Your workspace tasks, lists, and progression are active."
        eyebrow="Active workspace"
        title={workspace.name}
      />
      <Card className="border-border-soft bg-card/72 shadow-panel">
        <CardContent className="flex flex-col items-start gap-4 p-panel text-sm leading-7 text-ink-muted">
          <p>
            You are currently working in{" "}
            <strong className="text-foreground">{workspace.name}</strong>. All
            your tasks, daily habits, and study rooms are synchronized to this
            workspace.
          </p>
          <Button asChild variant="default">
            <Link className="inline-flex items-center gap-2" href="/today">
              Go to daily activity
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
