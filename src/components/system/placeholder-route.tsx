import { Gauge } from "lucide-react"

import { EmptyState } from "@/components/system/empty-state"
import { PageHeading } from "@/components/system/page-heading"

const placeholderContent = {
  progress: {
    description:
      "Reserved visual space for future, server-owned progression summaries.",
    emptyDescription:
      "No experience, streak, or progression is active yet. This is a presentation placeholder only.",
    emptyTitle: "Nothing to show yet",
    eyebrow: "Progress",
    icon: Gauge,
    title: "Progress",
  },
} as const

export type PlaceholderRouteKind = keyof typeof placeholderContent

export function PlaceholderRoute({ kind }: { kind: PlaceholderRouteKind }) {
  const content = placeholderContent[kind]
  const Icon = content.icon

  return (
    <div className="grid gap-section">
      <PageHeading
        description={content.description}
        eyebrow={content.eyebrow}
        title={content.title}
      />
      <EmptyState
        description={content.emptyDescription}
        icon={<Icon aria-hidden="true" className="size-6" />}
        title={content.emptyTitle}
      />
    </div>
  )
}
