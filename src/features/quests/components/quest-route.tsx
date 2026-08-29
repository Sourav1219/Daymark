import type { ReactNode } from "react"

import { PageHeading } from "@/components/system/page-heading"
import { Badge } from "@/components/ui/badge"
import {
  attachmentStorageAvailable,
  getAttachmentsByQuest,
} from "@/features/attachments/queries/attachment-query-service"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { getGateList } from "@/features/gates/queries/gate-query-service"
import { getLabelList } from "@/features/labels/queries/label-query-service"
import { QuestActiveBoard } from "@/features/quests/components/quest-active-board"
import { QuestFilterBar } from "@/features/quests/components/quest-filter-bar"
import { QuestList } from "@/features/quests/components/quest-list"
import {
  defaultQuestFilters,
  isQuestFiltered,
  type QuestListFilters,
} from "@/features/quests/domain/types"
import {
  getQuestList,
  getQuestParentOptions,
} from "@/features/quests/queries/quest-query-service"
import { getUserSettings } from "@/features/reminders/queries/user-settings-query-service"

type QuestRouteKind = "cleared" | "quests" | "today"

type QuestRouteProps = Readonly<{
  access: AccessContext
  filters?: QuestListFilters | undefined
  /** Optional custom heading node that replaces the default PageHeading. */
  heading?: ReactNode
  kind: QuestRouteKind
}>

const routeCopy = {
  cleared: {
    description:
      "Review completed tasks and reopen anything that still needs attention.",
    emptyDescription:
      "Completed tasks gather here with their completion time and can be reopened without losing their history.",
    emptyTitle: "No tasks have been completed",
    eyebrow: "Archive",
    title: "Completed",
  },
  quests: {
    description:
      "Create, organise, search, and filter tasks in this workspace. Filter state lives in the URL, so every view is shareable.",
    emptyDescription:
      "Create your first task above. Active tasks stay scoped to this workspace and can be completed when finished.",
    emptyTitle: "No active tasks yet",
    eyebrow: "All tasks",
    title: "Tasks",
  },
  today: {
    description:
      "Open tasks starting today, due today, or overdue in the workspace calendar.",
    emptyDescription:
      "No open task starts today or is due by the end of the workspace day.",
    emptyTitle: "You're all caught up",
    eyebrow: "Today",
    title: "Today",
  },
} as const

const filteredCopy = {
  emptyDescription:
    "No task matches the current search and filters. Adjust them or reset to see the full list again.",
  emptyTitle: "No tasks match these filters",
} as const

export async function QuestRoute({
  access,
  filters,
  heading,
  kind,
}: QuestRouteProps) {
  const copy = routeCopy[kind]
  const now = new Date()

  if (kind === "quests") {
    const activeFilters = filters ?? defaultQuestFilters
    const filtered = isQuestFiltered(activeFilters)

    const [active, deleted, gates, labels, parentOptions, settings] =
      await Promise.all([
        getQuestList(access, "active", { filters: activeFilters, now }),
        getQuestList(access, "deleted", { now }),
        getGateList(access, "active"),
        getLabelList(access),
        getQuestParentOptions(access),
        getUserSettings(access),
      ])
    const gateOptions = gates.map((gate) => ({ id: gate.id, name: gate.name }))
    const labelOptions = labels.map((label) => ({
      colorToken: label.colorToken,
      id: label.id,
      name: label.name,
    }))
    const attachmentsByQuest = await getAttachmentsByQuest(
      access,
      active.map(({ id }) => id),
    )
    const storageAvailable = attachmentStorageAvailable()

    return (
      <div className="quest-studio-page">
        <QuestActiveBoard
          attachmentsByQuest={attachmentsByQuest}
          deletedQuests={deleted}
          emptyDescription={
            filtered ? filteredCopy.emptyDescription : copy.emptyDescription
          }
          emptyTitle={filtered ? filteredCopy.emptyTitle : copy.emptyTitle}
          filters={activeFilters}
          gates={gateOptions}
          isFiltered={filtered}
          labels={labelOptions}
          parentOptions={parentOptions}
          quests={active}
          referenceNow={now.toISOString()}
          storageAvailable={storageAvailable}
          timezone={settings.timezone}
        />
      </div>
    )
  }

  const activeFilters = filters ?? defaultQuestFilters
  // Today and Cleared own their lifecycle. Ignore any hand-authored status
  // parameter and only report filters that can actually narrow these views.
  const fixedViewFilters = {
    ...activeFilters,
    status: defaultQuestFilters.status,
  } satisfies QuestListFilters
  const filtered = isQuestFiltered(fixedViewFilters)

  const [quests, gates, labels, parentOptions, settings] = await Promise.all([
    getQuestList(access, kind === "today" ? "today" : "cleared", {
      filters: fixedViewFilters,
      now,
    }),
    getGateList(access, "active"),
    getLabelList(access),
    getQuestParentOptions(access),
    getUserSettings(access),
  ])
  const gateOptions = gates.map((gate) => ({ id: gate.id, name: gate.name }))
  const labelOptions = labels.map((label) => ({
    colorToken: label.colorToken,
    id: label.id,
    name: label.name,
  }))
  const attachmentsByQuest = await getAttachmentsByQuest(
    access,
    quests.map(({ id }) => id),
  )
  const storageAvailable = attachmentStorageAvailable()
  return (
    <div className="grid gap-section">
      {heading ?? (
        <PageHeading
          actions={<Badge variant="outline">{quests.length} visible</Badge>}
          description={copy.description}
          eyebrow={copy.eyebrow}
          title={copy.title}
        />
      )}
      <QuestFilterBar
        filters={fixedViewFilters}
        gates={gateOptions}
        isFiltered={filtered}
        labels={labelOptions}
        showStatus={false}
      />
      <QuestList
        attachmentsByQuest={attachmentsByQuest}
        emptyDescription={
          filtered ? filteredCopy.emptyDescription : copy.emptyDescription
        }
        emptyTitle={filtered ? filteredCopy.emptyTitle : copy.emptyTitle}
        gates={gateOptions}
        labels={labelOptions}
        mode={kind}
        parentOptions={parentOptions}
        quests={quests}
        storageAvailable={storageAvailable}
        timezone={settings.timezone}
      />
    </div>
  )
}
