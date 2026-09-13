"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"

import { QuestCreateForm } from "@/features/quests/components/quest-create-form"
import { QuestPagination } from "@/features/quests/components/quest-pagination"
import type { AttachmentView } from "@/features/attachments/domain/types"
import type {
  QuestGateOption,
  QuestParentOption,
} from "@/features/quests/components/quest-form-fields"
import {
  QuestList,
  type QuestLabelOption,
} from "@/features/quests/components/quest-list"
import type { QuestView } from "@/features/quests/domain/types"
import { useOffline } from "@/features/offline/components/offline-provider"

type QuestActiveBoardProps = Readonly<{
  attachmentsByQuest?:
    Readonly<Record<string, readonly AttachmentView[]>> | undefined
  activePage?: number | undefined
  activeHasNextPage?: boolean | undefined
  deletedQuests?: readonly QuestView[] | undefined
  gates?: readonly QuestGateOption[] | undefined
  labels?: readonly QuestLabelOption[] | undefined
  parentOptions?: readonly QuestParentOption[] | undefined
  quests?: readonly QuestView[] | undefined
  referenceNow?: string | undefined
  storageAvailable?: boolean | undefined
  timezone?: string | undefined
  trashPage?: number | undefined
  trashHasNextPage?: boolean | undefined
}>

export function QuestActiveBoard({
  attachmentsByQuest = {},
  activeHasNextPage = false,
  activePage = 1,
  deletedQuests = [],
  gates = [],
  labels = [],
  parentOptions = [],
  quests = [],
  referenceNow = new Date().toISOString(),
  storageAvailable = false,
  timezone = "UTC",
  trashHasNextPage = false,
  trashPage = 1,
}: QuestActiveBoardProps) {
  const [activeTab, setActiveTab] = useState<"create" | "trash">("create")
  const [offlineQuests, setOfflineQuests] = useState<readonly QuestView[]>([])
  const { isOffline, pendingCount, snapshotQuests } = useOffline()
  const visibleQuests = useMemo(() => {
    const byId = new Map(quests.map((quest) => [quest.id, quest]))
    for (const quest of offlineQuests) byId.set(quest.id, quest)
    return Array.from(byId.values())
  }, [offlineQuests, quests])

  useEffect(() => {
    if (!isOffline && pendingCount === 0) void snapshotQuests(quests)
  }, [isOffline, pendingCount, quests, snapshotQuests])

  function rememberOfflineQuest(quest: QuestView) {
    setOfflineQuests((current) => [
      quest,
      ...current.filter(({ id }) => id !== quest.id),
    ])
    setActiveTab("create")
  }

  return (
    <div className="quest-studio">
      <header className="quest-overview">
        <div className="quest-overview__heading">
          <div>
            <span>Workspace</span>
            <h1>Tasks</h1>
          </div>
          <p>Create, organise, or recover tasks.</p>
        </div>
      </header>

      <div
        aria-label="Task workspace"
        className="quest-studio__tabs"
        role="tablist"
      >
        <button
          aria-controls="quest-create-panel"
          aria-selected={activeTab === "create"}
          className="quest-studio__tab"
          id="quest-create-tab"
          onClick={() => setActiveTab("create")}
          role="tab"
          type="button"
        >
          <Plus aria-hidden="true" />
          Create
          <span>Build a new task</span>
        </button>
        <button
          aria-controls="quest-trash-panel"
          aria-selected={activeTab === "trash"}
          className="quest-studio__tab"
          id="quest-trash-tab"
          onClick={() => setActiveTab("trash")}
          role="tab"
          type="button"
        >
          <Trash2 aria-hidden="true" />
          Trash
          <span>{deletedQuests.length} in Trash</span>
        </button>
      </div>

      <section
        aria-labelledby="quest-create-tab"
        className="quest-studio__panel"
        hidden={activeTab !== "create"}
        id="quest-create-panel"
        role="tabpanel"
      >
        <QuestCreateForm
          gates={gates}
          onOfflineQueued={rememberOfflineQuest}
          timezone={timezone}
        />
        {visibleQuests.length > 0 ? (
          <div className="mt-8 grid gap-4">
            <QuestList
              attachmentsByQuest={attachmentsByQuest}
              gates={gates}
              labels={labels}
              mode="active"
              parentOptions={parentOptions}
              quests={visibleQuests}
              referenceNow={referenceNow}
              reorderable
              storageAvailable={storageAvailable}
              timezone={timezone}
            />
            <QuestPagination
              hasNextPage={activeHasNextPage}
              page={activePage}
              paramName="page"
            />
          </div>
        ) : null}
      </section>

      <section
        aria-labelledby="quest-trash-tab"
        className="quest-studio__panel"
        hidden={activeTab !== "trash"}
        id="quest-trash-panel"
        role="tabpanel"
      >
        <QuestList
          attachmentsByQuest={attachmentsByQuest}
          emptyDescription="Tasks moved to Trash appear here. A task can only be restored on the day it was deleted."
          emptyTitle="Trash is empty"
          gates={gates}
          labels={labels}
          mode="deleted"
          parentOptions={parentOptions}
          quests={deletedQuests}
          referenceNow={referenceNow}
          storageAvailable={storageAvailable}
          timezone={timezone}
        />
        <QuestPagination
          hasNextPage={trashHasNextPage}
          page={trashPage}
          paramName="trashPage"
        />
      </section>
    </div>
  )
}
