"use client"

import { useCallback, useEffect, useState } from "react"
import type { Route } from "next"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { FilterX, Search, SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  defaultQuestFilters,
  type QuestListFilters,
} from "@/features/quests/domain/types"

type Option = Readonly<{ label: string; value: string }>

type QuestFilterBarProps = Readonly<{
  filters: QuestListFilters
  gates: readonly { id: string; name: string }[]
  isFiltered: boolean
  labels: readonly { id: string; name: string }[]
  onSearchInputChange?: ((value: string) => void) | undefined
  searchInputValue?: string | undefined
  showList?: boolean | undefined
  showStatus?: boolean | undefined
}>

const statusOptions: readonly Option[] = [
  { label: "Open", value: "open" },
  { label: "Completed", value: "completed" },
  { label: "Any status", value: "all" },
]

const priorityOptions: readonly Option[] = [
  { label: "Any priority", value: "any" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Critical", value: "critical" },
]

const dueOptions: readonly Option[] = [
  { label: "Any due date", value: "any" },
  { label: "Overdue", value: "overdue" },
  { label: "Due today", value: "today" },
  { label: "Upcoming", value: "upcoming" },
  { label: "No due date", value: "none" },
]

const sortOptions: readonly Option[] = [
  { label: "Manual order", value: "manual" },
  { label: "Due soonest", value: "due-soonest" },
  { label: "Due latest", value: "due-latest" },
  { label: "Priority", value: "priority" },
  { label: "Recently updated", value: "recently-updated" },
]

const selectClass =
  "h-8 w-full rounded-control border border-input bg-surface-inset px-2.5 text-sm text-ink outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

function FilterSelect({
  id,
  label,
  onChange,
  options,
  value,
}: Readonly<{
  id: string
  label: string
  onChange: (value: string) => void
  options: readonly Option[]
  value: string
}>) {
  return (
    <div className="quest-search-tools__field">
      <Label htmlFor={id}>{label}</Label>
      <select
        className={selectClass}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * Client-side filter controls. Debounced inputs only ever update URL search
 * params; the server-side query service re-runs when the page re-renders
 * with the new shareable URL state.
 */
export function QuestFilterBar({
  filters,
  gates,
  isFiltered,
  labels,
  onSearchInputChange,
  searchInputValue,
  showList = true,
  showStatus = true,
}: QuestFilterBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [searchInput, setSearchInput] = useState(filters.search)
  const [syncedSearch, setSyncedSearch] = useState(filters.search)
  const effectiveSearchInput = searchInputValue ?? searchInput

  // Stay in sync with external resets (e.g. the Reset filters button) by
  // adjusting state during render instead of mirroring props in an effect.
  if (filters.search !== syncedSearch) {
    setSyncedSearch(filters.search)
    setSearchInput(filters.search)
  }

  const updateParams = useCallback(
    (updates: Readonly<Record<string, string | null>>) => {
      const params = new URLSearchParams(searchParams.toString())

      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      }

      const query = params.toString()
      router.replace((query ? `${pathname}?${query}` : pathname) as Route, {
        scroll: false,
      })
    },
    [pathname, router, searchParams],
  )

  // Debounce search typing into URL updates.
  useEffect(() => {
    if (effectiveSearchInput === filters.search) {
      return
    }

    const handle = setTimeout(() => {
      updateParams({
        search: effectiveSearchInput === "" ? null : effectiveSearchInput,
      })
    }, 300)

    return () => clearTimeout(handle)
  }, [effectiveSearchInput, filters.search, updateParams])

  function setFilter(key: keyof QuestListFilters, value: string) {
    const defaultValue = defaultQuestFilters[key]
    updateParams({ [key]: value === defaultValue ? null : value })
  }

  function resetFilters() {
    onSearchInputChange?.("")
    setSearchInput("")
    updateParams({
      due: null,
      gateId: null,
      labelId: null,
      priority: null,
      search: null,
      sort: null,
      status: null,
    })
  }

  const gateOptions: readonly Option[] = [
    { label: "Any List", value: "any" },
    { label: "No List", value: "none" },
    ...(filters.gateId !== "any" &&
    filters.gateId !== "none" &&
    !gates.some((gate) => gate.id === filters.gateId)
      ? [{ label: "Unavailable list", value: filters.gateId }]
      : []),
    ...gates.map((gate) => ({ label: gate.name, value: gate.id })),
  ]

  const labelOptions: readonly Option[] = [
    { label: "Any Label", value: "any" },
    ...(filters.labelId !== "any" &&
    !labels.some((label) => label.id === filters.labelId)
      ? [{ label: "Unavailable Label", value: filters.labelId }]
      : []),
    ...labels.map((label) => ({ label: label.name, value: label.id })),
  ]
  const activeFilterCount = [
    filters.priority !== defaultQuestFilters.priority,
    filters.labelId !== defaultQuestFilters.labelId,
    filters.due !== defaultQuestFilters.due,
    filters.sort !== defaultQuestFilters.sort,
    showList && filters.gateId !== defaultQuestFilters.gateId,
    showStatus && filters.status !== defaultQuestFilters.status,
  ].filter(Boolean).length

  return (
    <section
      aria-label="Task search and filters"
      className="quest-search-tools"
    >
      <div className="quest-search-tools__topline">
        <span>
          <SlidersHorizontal aria-hidden="true" /> Refine your search
        </span>
        <small>
          {activeFilterCount > 0
            ? `${activeFilterCount} active`
            : "Quick filters"}
        </small>
      </div>
      <div className="quest-search-tools__query">
        <Label htmlFor="quest-search">What are you looking for?</Label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-system-blue"
          />
          <Input
            aria-label="Search"
            autoComplete="off"
            className="pl-12"
            id="quest-search"
            maxLength={160}
            onChange={(event) => {
              setSearchInput(event.target.value)
              onSearchInputChange?.(event.target.value)
            }}
            placeholder="Search titles and descriptions…"
            type="search"
            value={effectiveSearchInput}
          />
        </div>
      </div>

      <div className="quest-search-tools__filters">
        {showStatus ? (
          <FilterSelect
            id="quest-filter-status"
            label="Status"
            onChange={(value) => setFilter("status", value)}
            options={statusOptions}
            value={filters.status}
          />
        ) : null}
        <FilterSelect
          id="quest-filter-priority"
          label="Priority"
          onChange={(value) => setFilter("priority", value)}
          options={priorityOptions}
          value={filters.priority}
        />
        {showList ? (
          <FilterSelect
            id="quest-filter-gate"
            label="List"
            onChange={(value) => setFilter("gateId", value)}
            options={gateOptions}
            value={filters.gateId}
          />
        ) : null}
        <FilterSelect
          id="quest-filter-label"
          label="Label"
          onChange={(value) => setFilter("labelId", value)}
          options={labelOptions}
          value={filters.labelId}
        />
        <FilterSelect
          id="quest-filter-due"
          label="Due date"
          onChange={(value) => setFilter("due", value)}
          options={dueOptions}
          value={filters.due}
        />
        <FilterSelect
          id="quest-sort"
          label="Sort"
          onChange={(value) => setFilter("sort", value)}
          options={sortOptions}
          value={filters.sort}
        />
      </div>

      {isFiltered ? (
        <div className="quest-search-tools__reset">
          <Button onClick={resetFilters} size="sm" variant="outline">
            <FilterX aria-hidden="true" />
            Reset filters
          </Button>
          <p className="text-xs text-ink-muted">
            Filters are stored in the URL, so this view can be shared or
            bookmarked.
          </p>
        </div>
      ) : null}
    </section>
  )
}
