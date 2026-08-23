import { Tags } from "lucide-react"

import { EmptyState } from "@/components/system/empty-state"
import { PageHeading } from "@/components/system/page-heading"
import { Badge } from "@/components/ui/badge"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { LabelCard } from "@/features/labels/components/label-card"
import { LabelCreateForm } from "@/features/labels/components/label-create-form"
import { getLabelList } from "@/features/labels/queries/label-query-service"

export async function LabelRoute({
  access,
}: Readonly<{ access: AccessContext }>) {
  const labels = await getLabelList(access)

  return (
    <div className="grid gap-section">
      <PageHeading
        actions={<Badge variant="outline">{labels.length} labels</Badge>}
        description="Create reusable Labels and attach them to tasks. Labels cut across Lists and schedules, and each one offers a shareable filtered view of your tasks."
        eyebrow="Labels"
        title="Labels"
      />
      <LabelCreateForm />
      <section aria-labelledby="label-list-heading" className="grid gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold" id="label-list-heading">
            Workspace Labels
          </h2>
          <span className="font-mono text-xs text-ink-muted">
            {labels.length} Label{labels.length === 1 ? "" : "s"}
          </span>
        </div>
        {labels.length === 0 ? (
          <EmptyState
            description="Create the first Label above, then attach it to tasks from the task edit form."
            icon={<Tags aria-hidden="true" className="size-6" />}
            title="No Labels yet"
          />
        ) : (
          <div className="grid gap-4" role="list">
            {labels.map((label) => (
              <div key={label.id} role="listitem">
                <LabelCard label={label} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
