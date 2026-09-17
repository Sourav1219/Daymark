"use client"

import { useEffect, useState } from "react"
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
  const { isOffline, pendingCount, snapshotQuests } = useOffline()

  useEffect(() => {
    if (!isOffline && pendingCount === 0) void snapshotQuests(quests)
  }, [isOffline, pendingCount, quests, snapshotQuests])

  function rememberOfflineQuest() {
    setActiveTab("create")
  }

  return (
    <div className="quest-studio">
      <header className="quest-overview">
        <div>
          <span>Workspace</span>
          <h1>Tasks</h1>
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
          <span>Create</span>
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
          <span>Trash</span>
          {deletedQuests.length > 0 ? (
            <span className="quest-studio__tab-badge">
              {deletedQuests.length}
            </span>
          ) : null}
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
