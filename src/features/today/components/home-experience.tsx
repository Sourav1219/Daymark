"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { homeQuestSnapshot } from "@/features/today/domain/home-snapshot"
import { setAppBadge } from "@/lib/platform/platform-bridge"
import { toast } from "sonner"
import { TodayHeader } from "./today-header"
import { TodayPromo } from "./today-promo"
import { TodayFilters } from "./today-filters"
import { TodayTasks } from "./today-tasks"
import { DailyStudyHistory } from "@/features/timer/components/daily-study-history"
import type { DailyStudySummaryView } from "@/features/timer/domain/types"
import type { ReminderInboxData } from "@/features/reminders/domain/types"
import {
  resolveClassification,
  typeLabels,
  type TaskClassification,
} from "@/features/quests/domain/classification"
import {
  loadHomeFacets,
  loadHomePage,
  loadHomePages,
} from "@/features/today/application/home-actions"
import type { QuestPriority } from "@/features/quests/domain/types"
import type {
  HomeBucket,
  HomeFacets,
  HomeFilters,
  HomePage,
  TodayCard,
} from "@/features/today/types"
import { useOptionalOffline } from "@/features/offline/components/offline-provider"

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function scoreCard(
  card: TodayCard,
  normalizedQuery: string,
  queryWords: readonly string[],
): number {
  if (!normalizedQuery) return 0

  const title = (card.title || "").toLowerCase()
  const desc = (card.description || "").toLowerCase()
  const classification = resolveClassification(card)
  const customType = (
    classification.customType ||
    card.customType ||
    ""
  ).toLowerCase()
  const typeLabel = (typeLabels[classification.taskType] || "").toLowerCase()

  // Case-insensitive match: every word in the query must match title, description, or type
  const allMatch = queryWords.every(
    (w) =>
      title.includes(w) ||
      desc.includes(w) ||
      customType.includes(w) ||
      typeLabel.includes(w),
  )
  if (!allMatch) return -1

  let score = 0

  // Exact title match -> top score
  if (title === normalizedQuery) {
    score += 1000
  }
  // Title starts with full query
  else if (title.startsWith(normalizedQuery)) {
    score += 500
  }
  // Title contains full query -> scaled by earliest occurrence
  else if (title.includes(normalizedQuery)) {
    const idx = title.indexOf(normalizedQuery)
    score += Math.max(100, 350 - idx * 10)
  }

  // Word boundary matches in title (e.g. "cl" matches "Reply to [cl]ient")
  for (const w of queryWords) {
    if (title.startsWith(w)) {
      score += 200
    } else {
      const boundaryRegex = new RegExp(`(?:^|\\s|[._-])${escapeRegExp(w)}`, "i")
      if (boundaryRegex.test(title)) {
        score += 150
      }
    }
  }

  // Matches in description
  if (desc && desc.includes(normalizedQuery)) {
    score += 40
  }

  // Matches in category/type
  if (
    typeLabel.includes(normalizedQuery) ||
    customType.includes(normalizedQuery)
  ) {
    score += 30
  }

  return score
}

export function HomeExperience(
  props: Readonly<{
    activeLabelId: string
    facets: HomeFacets
    focusedQuestId?: string | undefined
    history: readonly DailyStudySummaryView[]
    inbox: ReminderInboxData
    initialPages: readonly HomePage[]
    labels: readonly { id: string; name: string }[]
    referenceNow: string
    selectedDate: string
    streak: number
    timezone: string
    todayDate: string
  }>,
) {
  const [filters, setFilters] = useState<HomeFilters>({
    customType: null,
    taskType: "any",
    priority: "any",
    labelId: props.activeLabelId,
  })
  const [pages, setPages] = useState(props.initialPages)
  const [facets, setFacets] = useState(props.facets)
  const [lastInitialPages, setLastInitialPages] = useState(props.initialPages)
  if (lastInitialPages !== props.initialPages) {
    setLastInitialPages(props.initialPages)
    setPages(props.initialPages)
    setFacets(props.facets)
  }
  const [pending, startTransition] = useTransition()
  const [loadingBucket, setLoadingBucket] = useState<HomeBucket | null>(null)
  const requestId = useRef(0)
  const offline = useOptionalOffline()
  const historical = props.selectedDate < props.todayDate
  const snapshotQuests = offline?.snapshotQuests
  useEffect(() => {
    if (!snapshotQuests || offline?.isOffline) return
    const cards = pages
      .filter((page) => page.bucket !== "deleted")
      .flatMap((page) => page.cards)
    void snapshotQuests(cards.map(homeQuestSnapshot)).catch(() => {})
  }, [snapshotQuests, offline?.isOffline, pages])
  useEffect(() => {
    void setAppBadge(
      pages.find((page) => page.bucket === "active")?.cards.length ?? 0,
    )
  }, [pages])

  function changeFilters(next: HomeFilters) {
    setFilters(next)
    if (
      next.taskType === "any" &&
      next.priority === "any" &&
      next.labelId === props.activeLabelId &&
      !next.search?.trim()
    ) {
      setPages(props.initialPages)
      setFacets(props.facets)
    }
  }

  useEffect(() => {
    const request = ++requestId.current
    if (
      offline?.isOffline ||
      (filters.taskType === "any" &&
        filters.priority === "any" &&
        filters.labelId === props.activeLabelId &&
        !filters.search?.trim())
    )
      return
    let cancelled = false
    const isSearching = Boolean(filters.search?.trim())

    // For live searching, debounce the background server sync (600ms) to avoid lagging the client
    // while client-side filtering responds instantaneously at 0ms.
    const timer = isSearching
      ? setTimeout(executeFetch, 600)
      : (executeFetch(), null)

    function executeFetch() {
      if (isSearching) {
        // Quiet background fetch without setting pending = true to keep UI subtle and fast
        void runBackgroundFetch()
      } else {
        startTransition(runBackgroundFetch)
      }
    }

    async function runBackgroundFetch() {
      try {
        const loaded = await loadHomePages({
          date: props.selectedDate,
          filters,
        })
        if (!cancelled && request === requestId.current) {
          startTransition(() => {
            if (isSearching) {
              setPages((prev) =>
                loaded.pages.map((serverPage) => {
                  const existingPage = prev.find(
                    (p) => p.bucket === serverPage.bucket,
                  )
                  if (!existingPage) return serverPage
                  const existingIds = new Set(
                    existingPage.cards.map((c) => c.id),
                  )
                  const newCards = serverPage.cards.filter(
                    (c) => !existingIds.has(c.id),
                  )
                  return {
                    ...serverPage,
                    cards: [...existingPage.cards, ...newCards],
                  }
                }),
              )
            } else {
              setPages(loaded.pages)
            }
            setFacets(loaded.facets)
          })
        }
      } catch {
        if (!cancelled && !isSearching)
          toast.error("Could not load filtered tasks. Please retry.")
      }
    }

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [
    filters,
    props.initialPages,
    props.selectedDate,
    props.activeLabelId,
    offline?.isOffline,
  ])

  function more(bucket: HomeBucket) {
    const page = pages.find((item) => item.bucket === bucket)
    if (!page || loadingBucket || pending) return
    const request = requestId.current
    setLoadingBucket(bucket)
    startTransition(async () => {
      try {
        const next = await loadHomePage({
          bucket,
          date: props.selectedDate,
          filters,
          offset: page.offset,
        })
        if (request === requestId.current)
          setPages((current) =>
            current.map((item) =>
              item.bucket === bucket
                ? {
                    ...next,
                    cards: [
                      ...item.cards,
                      ...next.cards.filter(
                        (card) => !item.cards.some((old) => old.id === card.id),
                      ),
                    ],
                  }
                : item,
            ),
          )
      } catch {
        toast.error("Could not load more tasks. Please retry.")
      } finally {
        setLoadingBucket(null)
      }
    })
  }

  function classified(
    id: string,
    value: TaskClassification,
    version: number,
    priority?: QuestPriority,
  ) {
    if (!offline?.isOffline)
      void loadHomeFacets()
        .then(setFacets)
        .catch(() => {})
    setPages((current) =>
      current.map((page) => ({
        ...page,
        cards: page.cards.map((card) =>
          card.id === id
            ? {
                ...card,
                ...value,
                ...(priority ? { priority } : {}),
                version,
              }
            : card,
        ),
      })),
    )
  }

  const titles = {
    active: "My tasks",
    completed: "Completed",
    missed: "Missed",
    deleted: "Recently deleted",
  }
  const searchQuery = filters.search?.trim() ?? ""
  const normalizedQuery = searchQuery.toLowerCase()
  const queryWords = useMemo(
    () => normalizedQuery.split(/\s+/).filter(Boolean),
    [normalizedQuery],
  )

  const visiblePages = useMemo(() => {
    return pages
      .filter((page) => page.bucket !== "deleted")
      .map((page) => {
        const filtered = page.cards.filter((card) => {
          const value = resolveClassification(card)
          const matchesType =
            filters.taskType === "any" ||
            (value.taskType === filters.taskType &&
              (filters.taskType !== "custom" ||
                value.customType === filters.customType))
          const matchesPriority =
            filters.priority === "any" || card.priority === filters.priority

          if (!matchesType || !matchesPriority) return false

          // Instant, 0ms in-memory filter: no delay on 1-2 letters
          if (!normalizedQuery) return true

          return scoreCard(card, normalizedQuery, queryWords) >= 0
        })

        // Dynamic sorting/ranking as user writes 1-2 or more letters
        if (normalizedQuery) {
          filtered.sort((a, b) => {
            const scoreA = scoreCard(a, normalizedQuery, queryWords)
            const scoreB = scoreCard(b, normalizedQuery, queryWords)
            if (scoreB !== scoreA) {
              return scoreB - scoreA
            }
            return 0
          })
        }

        return {
          ...page,
          cards: filtered,
        }
      })
  }, [
    pages,
    filters.taskType,
    filters.customType,
    filters.priority,
    normalizedQuery,
    queryWords,
  ])

  return (
    <>
      <TodayHeader
        activeLabelId={props.activeLabelId}
        inbox={props.inbox}
        referenceNow={props.referenceNow}
        selectedDate={props.selectedDate}
        streak={props.streak}
        todayDate={props.todayDate}
        timezone={props.timezone}
      />
      {props.selectedDate === props.todayDate ? <TodayPromo /> : null}
      <TodayFilters
        activeLabelId={props.activeLabelId}
        facets={facets}
        filters={filters}
        labels={props.labels}
        onChange={changeFilters}
        selectedDate={props.selectedDate}
      />
      <div aria-busy={pending && !normalizedQuery} className="home-task-lists">
        {pending && !normalizedQuery ? (
          <p className="home-list-status" role="status">
            Updating tasks…
          </p>
        ) : null}
        {visiblePages.every((page) => page.cards.length === 0) &&
        (filters.taskType !== "any" ||
          filters.priority !== "any" ||
          Boolean(filters.search?.trim())) ? (
          <div className="home-filter-empty">
            <p>
              {filters.search?.trim()
                ? `No tasks matching \u201c${filters.search.trim()}\u201d.`
                : "No tasks match this combination."}
            </p>
            <button
              onClick={() =>
                changeFilters({
                  ...filters,
                  customType: null,
                  taskType: "any",
                  priority: "any",
                  search: undefined,
                })
              }
              type="button"
            >
              Clear filters
            </button>
          </div>
        ) : null}
        {visiblePages.map((page) => (
          <div key={page.bucket}>
            <TodayTasks
              empty={
                page.bucket === "active" &&
                page.cards.length === 0 &&
                filters.taskType === "any" &&
                filters.priority === "any" &&
                !filters.search?.trim()
              }
              focusedQuestId={props.focusedQuestId}
              historical={historical}
              onClassified={classified}
              referenceNow={props.referenceNow}
              selectedDate={props.selectedDate}
              sections={
                page.cards.length
                  ? [{ title: titles[page.bucket], cards: page.cards }]
                  : []
              }
              timezone={props.timezone}
            />
            {page.hasMore ? (
              <button
                className="home-show-more"
                disabled={pending || Boolean(offline?.isOffline)}
                onClick={() => more(page.bucket)}
                type="button"
              >
                {loadingBucket === page.bucket
                  ? "Loading…"
                  : `Show more ${titles[page.bucket].toLowerCase()}`}
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <DailyStudyHistory
        history={props.history}
        selectedDate={props.selectedDate}
      />
    </>
  )
}
