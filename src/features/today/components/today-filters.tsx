"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  BookOpen,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  House,
  Search,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react"
import {
  typeLabels,
  type TaskType,
} from "@/features/quests/domain/classification"
import type { QuestPriority } from "@/features/quests/domain/types"
import type { HomeFacets, HomeFilters } from "@/features/today/types"

export const taskTypeIcons: Record<TaskType, LucideIcon> = {
  personal: House,
  work: BriefcaseBusiness,
  study: BookOpen,
  custom: Sparkles,
}

const priorityLabels: Record<QuestPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
}

export function TodayFilters({
  activeLabelId,
  facets = { priorities: [], types: [] },
  labels,
  selectedDate,
  filters = {
    customType: null,
    taskType: "any",
    priority: "any",
    labelId: activeLabelId,
  },
  onChange,
}: Readonly<{
  activeLabelId: string
  facets?: HomeFacets
  selectedDate?: string
  labels: readonly { id: string; name: string }[]
  filters?: HomeFilters
  onChange?: (filters: HomeFilters) => void
}>) {
  const [panel, setPanel] = useState<"type" | "priority" | null>(null)
  const [searchOpen, setSearchOpen] = useState(Boolean(filters.search?.trim()))
  const [searchDraft, setSearchDraft] = useState(filters.search ?? "")
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchTriggerRef = useRef<HTMLButtonElement>(null)
  const lastEmittedSearch = useRef<string | undefined>(filters.search)

  // Only synchronize if the search filter was changed externally (e.g. clicking "All" or "Clear filters")
  useEffect(() => {
    if (filters.search !== lastEmittedSearch.current) {
      lastEmittedSearch.current = filters.search
      setSearchDraft(filters.search ?? "")
      if (filters.search?.trim()) {
        // External filter changes intentionally synchronize this controlled UI state.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSearchOpen(true)
      } else if (filters.search === undefined) {
        setSearchOpen(false)
      }
    }
  }, [filters.search])

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  function applySearch(term: string) {
    const clean = term.trim()
    lastEmittedSearch.current = clean || undefined
    onChange?.({
      ...filters,
      search: clean || undefined,
    })
  }

  function handleDraftChange(value: string) {
    setSearchDraft(value)
    const clean = value.trim()
    lastEmittedSearch.current = clean || undefined
    onChange?.({
      ...filters,
      search: clean || undefined,
    })
  }

  function handleClear() {
    setSearchDraft("")
    lastEmittedSearch.current = undefined
    onChange?.({
      ...filters,
      search: undefined,
    })
    searchInputRef.current?.focus()
  }

  function closeSearch() {
    setSearchOpen(false)
    setSearchDraft("")
    lastEmittedSearch.current = undefined
    onChange?.({
      ...filters,
      search: undefined,
    })
    requestAnimationFrame(() => searchTriggerRef.current?.focus())
  }

  return (
    <div className="home-filters">
      <nav
        aria-label="Filter tasks"
        className="today-chips home-filter-chips"
        data-search-open={searchOpen}
      >
        <div
          aria-hidden={searchOpen}
          className="home-filter-chips__controls"
          inert={searchOpen}
        >
          <button
            className="today-chip"
            data-active={
              filters.taskType === "any" &&
              filters.priority === "any" &&
              filters.labelId === "any" &&
              !filters.search?.trim()
            }
            onClick={() => {
              setSearchOpen(false)
              setSearchDraft("")
              onChange?.({
                customType: null,
                taskType: "any",
                priority: "any",
                labelId: "any",
                search: undefined,
              })
            }}
            type="button"
          >
            All
          </button>
          <button
            aria-controls="home-type-options"
            aria-expanded={panel === "type"}
            className="today-chip home-filter-chip"
            data-kind="type"
            data-type={
              filters.taskType === "any" ? undefined : filters.taskType
            }
            onClick={() => setPanel(panel === "type" ? null : "type")}
            type="button"
          >
            {filters.taskType === "any"
              ? "Type"
              : filters.taskType === "custom"
                ? (filters.customType ?? "Custom")
                : typeLabels[filters.taskType]}
            <ChevronDown aria-hidden="true" />
          </button>
          <button
            aria-controls="home-priority-options"
            aria-expanded={panel === "priority"}
            className="today-chip home-filter-chip"
            data-kind="priority"
            data-priority={
              filters.priority === "any" ? undefined : filters.priority
            }
            onClick={() => setPanel(panel === "priority" ? null : "priority")}
            type="button"
          >
            {filters.priority === "any"
              ? "Priority"
              : priorityLabels[filters.priority]}
            <ChevronDown aria-hidden="true" />
          </button>
        </div>
        <button
          aria-hidden={searchOpen}
          aria-label="Search tasks"
          className="today-chip home-search-chip"
          id="home-search-trigger"
          inert={searchOpen}
          onClick={() => {
            setPanel(null)
            setSearchOpen(true)
          }}
          ref={searchTriggerRef}
          type="button"
        >
          <Search aria-hidden="true" />
        </button>
        <div
          aria-hidden={!searchOpen}
          className="home-search-bar-slot"
          inert={!searchOpen}
        >
          <div className="home-search-bar-wrap">
            <div
              className="home-search-field"
              onClick={() => searchInputRef.current?.focus()}
            >
              <Search aria-hidden="true" className="home-search-field__icon" />
              <input
                aria-label="Search tasks"
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                className="home-search-field__input"
                onChange={(event) => handleDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    applySearch(searchDraft)
                  }
                  if (event.key === "Escape") {
                    event.preventDefault()
                    closeSearch()
                  }
                }}
                placeholder="Search by title, tag, or description…"
                ref={searchInputRef}
                spellCheck={false}
                type="search"
                value={searchDraft}
              />
              {searchDraft ? (
                <button
                  aria-label="Clear search"
                  className="home-search-field__clear"
                  onClick={(event) => {
                    event.stopPropagation()
                    handleClear()
                  }}
                  type="button"
                >
                  <X aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <button
              aria-label="Close search"
              className="home-search-cancel-btn"
              onClick={closeSearch}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      </nav>
      {panel === "type" ? (
        <section
          aria-label="Task type"
          className="home-choice-panel"
          data-kind="type"
          id="home-type-options"
        >
          <div className="home-choice-panel__heading">
            <span>Task type</span>
            <button
              aria-label="Close filters"
              onClick={() => setPanel(null)}
              type="button"
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="home-choice-grid">
            <button
              aria-pressed={filters.taskType === "any"}
              onClick={() => {
                onChange?.({
                  ...filters,
                  customType: null,
                  taskType: "any",
                })
                setPanel(null)
              }}
              type="button"
            >
              <Check aria-hidden="true" />
              Any
            </button>
            {facets.types.map((facet) => {
              const Icon = taskTypeIcons[facet.taskType]
              const label =
                facet.taskType === "custom"
                  ? (facet.customType ?? "Custom")
                  : typeLabels[facet.taskType]
              return (
                <button
                  aria-pressed={
                    filters.taskType === facet.taskType &&
                    (facet.taskType !== "custom" ||
                      filters.customType === facet.customType)
                  }
                  data-type={facet.taskType}
                  key={`${facet.taskType}:${facet.customType ?? ""}`}
                  onClick={() => {
                    onChange?.({
                      ...filters,
                      customType:
                        facet.taskType === "custom" ? facet.customType : null,
                      taskType: facet.taskType,
                    })
                    setPanel(null)
                  }}
                  type="button"
                >
                  <Icon aria-hidden="true" />
                  {label}
                </button>
              )
            })}
          </div>
          <p>Choose a type to filter your tasks</p>
        </section>
      ) : null}
      {panel === "priority" ? (
        <section
          aria-label="Priority"
          className="home-choice-panel"
          data-kind="priority"
          id="home-priority-options"
        >
          <div className="home-choice-panel__heading">
            <span>Priority</span>
            <button
              aria-label="Close filters"
              onClick={() => setPanel(null)}
              type="button"
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="home-choice-grid">
            <button
              aria-pressed={filters.priority === "any"}
              onClick={() => {
                onChange?.({
                  ...filters,
                  priority: "any",
                })
                setPanel(null)
              }}
              type="button"
            >
              <Check aria-hidden="true" />
              Any
            </button>
            {facets.priorities.map((priority) => (
              <button
                aria-pressed={filters.priority === priority}
                data-priority={priority}
                key={priority}
                onClick={() => {
                  onChange?.({ ...filters, priority })
                  setPanel(null)
                }}
                type="button"
              >
                {priorityLabels[priority]}
              </button>
            ))}
          </div>
          <p>Choose a priority to filter your tasks</p>
        </section>
      ) : null}
      {labels.length > 0 ? (
        <nav aria-label="Filter by label" className="home-labels">
          {activeLabelId !== "any" ? (
            <Link href={{ pathname: "/today", query: { date: selectedDate } }}>
              All labels
            </Link>
          ) : null}
          {labels.map((label) => (
            <Link
              aria-current={activeLabelId === label.id ? "true" : undefined}
              href={{
                pathname: "/today",
                query: { date: selectedDate, labelId: label.id },
              }}
              key={label.id}
            >
              {label.name}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  )
}
