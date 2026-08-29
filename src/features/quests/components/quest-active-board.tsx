"use client"

import { useEffect, useState } from "react"
import { ListOrdered, Plus, Search, Trash2 } from "lucide-react"

import { QuestCreateForm } from "@/features/quests/components/quest-create-form"
import { QuestFilterBar } from "@/features/quests/components/quest-filter-bar"
import type { AttachmentView } from "@/features/attachments/domain/types"
import type {
  QuestGateOption,
  QuestParentOption,
} from "@/features/quests/components/quest-form-fields"
import {
  QuestList,
  type QuestLabelOption,
} from "@/features/quests/components/quest-list"
import type {
  QuestListFilters,
  QuestView,
} from "@/features/quests/domain/types"
import { useOffline } from "@/features/offline/components/offline-provider"

type QuestActiveBoardProps = Readonly<{
  attachmentsByQuest: Readonly<Record<string, readonly AttachmentView[]>>
  deletedQuests: readonly QuestView[]
  emptyDescription: string
  emptyTitle: string
  filters: QuestListFilters
  gates: readonly QuestGateOption[]
  isFiltered: boolean
  labels: readonly QuestLabelOption[]
  parentOptions: readonly QuestParentOption[]
  quests: readonly QuestView[]
  referenceNow?: string
  storageAvailable: boolean
  timezone: string
}>

export function QuestActiveBoard({
  attachmentsByQuest,
  deletedQuests,
  emptyDescription,
  emptyTitle,
  filters,
  gates,
  isFiltered,
  labels,
  parentOptions,
  quests,
  referenceNow = new Date().toISOString(),
  storageAvailable,
  timezone,
}: QuestActiveBoardProps) {
  const [activeTab, setActiveTab] = useState<"create" | "search" | "trash">(
    isFiltered ? "search" : "create",
  )
  const [offlineQueuedQuests, setOfflineQueuedQuests] = useState<
    readonly QuestView[]
  >([])
  const [searchState, setSearchState] = useState(() => ({
    draft: filters.search,
    synced: filters.search,
  }))
  const [showAllForOrdering, setShowAllForOrdering] = useState(false)
  const { isOffline, pendingCount, snapshotQuests } = useOffline()

  useEffect(() => {
    let cancelled = false

    void snapshotQuests(quests).then(() => {
      if (!cancelled && !isOffline && pendingCount === 0) {
        setOfflineQueuedQuests([])
      }
    })

    return () => {
      cancelled = true
    }
  }, [isOffline, pendingCount, quests, snapshotQuests])

  const hasSearchCriteria =
    searchState.draft.trim().length > 0 ||
    filters.due !== "any" ||
    filters.gateId !== "any" ||
    filters.labelId !== "any" ||
    filters.priority !== "any" ||
    filters.status !== "open"
  if (filters.search !== searchState.synced) {
    setSearchState((current) => ({
      draft: current.draft === current.synced ? filters.search : current.draft,
      synced: filters.search,
    }))
  }

  const searchTerm = searchState.draft.trim().toLocaleLowerCase()
  const visibleQuests = [...offlineQueuedQuests, ...quests].filter((quest) =>
    searchTerm
      ? `${quest.title}\n${quest.description}`
          .toLocaleLowerCase()
          .includes(searchTerm)
      : true,
  )

  return (
    <div className="quest-studio">
      <header className="quest-overview">
        <div className="quest-overview__heading">
          <div>
            <span>Workspace</span>
            <h1>Tasks</h1>
          </div>
          <p>Create a task or search everything you have.</p>
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
          aria-controls="quest-search-panel"
          aria-selected={activeTab === "search"}
          className="quest-studio__tab"
          id="quest-search-tab"
          onClick={() => setActiveTab("search")}
          role="tab"
          type="button"
        >
          <Search aria-hidden="true" />
          Search
          <span>Find and refine</span>
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
          onOfflineQueued={(quest) =>
            setOfflineQueuedQuests((current) => [...current, quest])
          }
          parentOptions={parentOptions}
          timezone={timezone}
        />
      </section>

      <section
        aria-labelledby="quest-search-tab"
        className="quest-studio__panel"
        hidden={activeTab !== "search"}
        id="quest-search-panel"
        role="tabpanel"
      >
        <QuestFilterBar
          filters={filters}
          gates={gates}
          isFiltered={isFiltered}
          labels={labels}
          onSearchInputChange={(draft) => {
            setShowAllForOrdering(false)
            setSearchState((current) => ({ ...current, draft }))
          }}
          searchInputValue={searchState.draft}
          showList={false}
          showStatus={false}
        />
        {!hasSearchCriteria && !showAllForOrdering ? (
          <div className="quest-search-empty quest-search-empty--idle">
            <span aria-hidden="true">
              <Search />
            </span>
            <div>
              <h3>Search for a task</h3>
              <p>
                Enter a title or description above. Results only appear after
                you search or choose a filter.
              </p>
              <button
                className="quest-search-empty__arrange"
                onClick={() => setShowAllForOrdering(true)}
                type="button"
              >
                <ListOrdered aria-hidden="true" />
                Arrange all tasks
              </button>
            </div>
          </div>
        ) : visibleQuests.length > 0 ? (
          <div className="quest-studio__results">
            <QuestList
              attachmentsByQuest={attachmentsByQuest}
              emptyDescription={emptyDescription}
              emptyTitle={emptyTitle}
              gates={gates}
              labels={labels}
              mode={showAllForOrdering ? "active" : "search"}
              parentOptions={parentOptions}
              quests={visibleQuests}
              reorderable={showAllForOrdering}
              storageAvailable={storageAvailable}
              timezone={timezone}
            />
          </div>
        ) : (
          <div className="quest-search-empty quest-search-empty--no-results">
            <span aria-hidden="true">
              <Search />
            </span>
            <div>
              <h3>{emptyTitle}</h3>
              <p>{emptyDescription}</p>
            </div>
          </div>
        )}
      </section>

      <section
        aria-labelledby="quest-trash-tab"
        className="quest-studio__panel"
        hidden={activeTab !== "trash"}
        id="quest-trash-panel"
        role="tabpanel"
      >
        <QuestList
          emptyDescription="Tasks moved to Trash appear here. Same-day deletions can be restored; older tasks can be copied for today."
          emptyTitle="Trash is empty"
          gates={gates}
          mode="deleted"
          parentOptions={parentOptions}
          quests={deletedQuests}
          referenceNow={referenceNow}
          storageAvailable={storageAvailable}
          timezone={timezone}
        />
      </section>
    </div>
  )
}
