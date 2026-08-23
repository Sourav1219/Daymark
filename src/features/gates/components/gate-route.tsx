import { Archive } from "lucide-react"

import { EmptyState } from "@/components/system/empty-state"
import { PageHeading } from "@/components/system/page-heading"
import { Badge } from "@/components/ui/badge"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { GateCard } from "@/features/gates/components/gate-card"
import { GateCreateForm } from "@/features/gates/components/gate-create-form"
import type { GateView } from "@/features/gates/domain/types"
import { getGateList } from "@/features/gates/queries/gate-query-service"
import { cn } from "@/lib/utils"

function GateSection({
  className,
  description,
  gates,
  headingId,
  title,
}: Readonly<{
  className?: string
  description: string
  gates: readonly GateView[]
  headingId: string
  title: string
}>) {
  return (
    <section
      aria-labelledby={headingId}
      className={cn("grid gap-4", className)}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold" id={headingId}>
            {title}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{description}</p>
        </div>
        <span className="font-mono text-xs text-ink-muted">
          {gates.length} List{gates.length === 1 ? "" : "s"}
        </span>
      </div>
      {gates.length === 0 ? (
        <EmptyState
          description={
            headingId === "archived-gate-heading"
              ? "Archived Lists rest here. They keep their task history and can be restored at any time."
              : "Create your first List above, then assign tasks to it from task forms or filters."
          }
          icon={<Archive aria-hidden="true" className="size-6" />}
          title={
            headingId === "archived-gate-heading"
              ? "No archived Lists"
              : "No Lists yet"
          }
        />
      ) : (
        <div className="grid gap-4" role="list">
          {gates.map((gate) => (
            <div key={gate.id} role="listitem">
              <GateCard gate={gate} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export async function GateRoute({
  access,
}: Readonly<{ access: AccessContext }>) {
  const [active, archived] = await Promise.all([
    getGateList(access, "active"),
    getGateList(access, "archived"),
  ])

  return (
    <div className="grid gap-section">
      <PageHeading
        actions={<Badge variant="outline">{active.length} active</Badge>}
        description="Organise tasks into named Lists. Each List offers a shareable filtered view of your tasks, and archived Lists keep history without cluttering active work."
        eyebrow="Lists"
        title="Lists"
      />
      <GateCreateForm />
      <GateSection
        description="Assign tasks to a List to build focused, shareable views."
        gates={active}
        headingId="active-gate-heading"
        title="Active Lists"
      />
      <GateSection
        className="border-t border-border-soft pt-section"
        description="Archived Lists keep their task assignments but leave active navigation."
        gates={archived}
        headingId="archived-gate-heading"
        title="Archived Lists"
      />
    </div>
  )
}
