"use client"

import {
  createContext,
  useContext,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import type { Route } from "next"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { flushSync } from "react-dom"
import {
  CalendarDays,
  CalendarCheck2,
  Check,
  ChevronDown,
  Circle,
  CircleCheckBig,
  CircleX,
  Clock3,
  Flame,
  History,
  MessageSquareText,
  Plus,
  Star,
  Trash2,
  Undo2,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  completeQuestAction,
  softDeleteQuestAction,
} from "@/features/quests/application/actions"
import {
  TaskDeletedPopup,
  type DeletedTaskNotice,
} from "@/features/quests/components/task-deleted-popup"
import {
  TaskRescheduledPopup,
  type RestoredTaskNotice,
} from "@/features/quests/components/task-restored-popup"
import { type CompletedTaskNotice } from "@/features/quests/components/task-completed-popup"
import { useTaskCompletionCelebration } from "@/features/quests/components/task-completion-celebration-provider"
import type { QuestPriority } from "@/features/quests/domain/types"
import {
  focusTodayTaskEvent,
  taskCompletionUndoEvent,
  type TaskCompletionUndoEventDetail,
  todayTaskElementId,
} from "@/features/quests/domain/quest-links"
import type { TodayCard, TodaySection } from "@/features/today/types"
import { triggerHaptic } from "@/lib/platform/platform-bridge"

const priorityIcon: Record<QuestPriority, LucideIcon> = {
  critical: Flame,
  high: Zap,
  low: Circle,
  medium: Star,
}
import { TaskClassificationControl } from "./task-classification-control"
import { HomeDeletedRows } from "./home-deleted-rows"
import { RestoreQuestScheduleDialog } from "@/features/quests/components/restore-quest-schedule-dialog"
import type { TaskClassification } from "@/features/quests/domain/classification"

type ClassificationHandler = (
  id: string,
  value: TaskClassification,
  version: number,
  priority?: QuestPriority,
) => void
const TodayTaskContext = createContext<{
  timezone: string
  onClassified?: ClassificationHandler | undefined
  onRescheduled?: ((task: RestoredTaskNotice) => void) | undefined
}>({ timezone: "UTC" })

type TodayTasksProps = Readonly<{
  timezone?: string
  onClassified?: ClassificationHandler | undefined
  empty: boolean
  focusedQuestId?: string | undefined
  historical?: boolean
  referenceNow?: string
  selectedDate?: string
  sections: readonly TodaySection[]
}>

export function TodayTasks({
  timezone = "UTC",
  onClassified,
  empty,
  focusedQuestId,
  historical = false,
  referenceNow,
  selectedDate,
  sections,
}: TodayTasksProps) {
  const showCompletion = useTaskCompletionCelebration()
  const router = useRouter()
  const lastFocusedQuestId = useRef<string | null>(null)
  const glowTimer = useRef<number | null>(null)
  const [deletedTask, setDeletedTask] = useState<DeletedTaskNotice | null>(null)
  const [rescheduledTask, setRescheduledTask] =
    useState<RestoredTaskNotice | null>(null)
  const [optimisticallyDeletedIds, setOptimisticallyDeletedIds] = useState<
    ReadonlySet<string>
  >(() => new Set())
  const [optimisticallyReopened, setOptimisticallyReopened] = useState<
    ReadonlyMap<string, number | null>
  >(() => new Map())
  const [glowingQuestId, setGlowingQuestId] = useState<string | null>(null)
  const [now, setNow] = useState(() =>
    referenceNow ? new Date(referenceNow).getTime() : Date.now(),
  )
  const visibleSections = useMemo(() => {
    const reopenedCards = sections.flatMap((section) =>
      section.cards
        .filter(
          (card) =>
            card.status === "completed" && optimisticallyReopened.has(card.id),
        )
        .map((card) => ({
          ...card,
          completedAt: null,
          status: "open" as const,
          version: optimisticallyReopened.get(card.id) ?? card.version + 1,
        })),
    )
    const hasActiveSection = sections.some(
      (section) => section.title === "My tasks",
    )
    const preparedSections = sections.map((section) => {
      const completedSection =
        section.title === "Completed today" || section.title === "Completed"
      const cards = section.cards
        .filter(
          (card) =>
            !optimisticallyDeletedIds.has(card.id) &&
            !(completedSection && optimisticallyReopened.has(card.id)),
        )
        .map((card) =>
          optimisticallyReopened.has(card.id)
            ? {
                ...card,
                completedAt: null,
                status: "open" as const,
                version:
                  optimisticallyReopened.get(card.id) ?? card.version + 1,
              }
            : card,
        )

      return {
        ...section,
        cards: [
          ...cards,
          ...(section.title === "My tasks" ? reopenedCards : []),
        ],
      }
    })

    if (!hasActiveSection && reopenedCards.length > 0) {
      preparedSections.unshift({ cards: reopenedCards, title: "My tasks" })
    }

    return preparedSections.filter((section) => section.cards.length > 0)
  }, [optimisticallyDeletedIds, optimisticallyReopened, sections])
  const nextDeadline = useMemo(() => {
    const upcoming = visibleSections
      .flatMap(({ cards }) => cards)
      .filter(({ status }) => status === "open")
      .map(({ dueAt }) => (dueAt ? new Date(dueAt).getTime() : Number.NaN))
      .filter((deadline) => Number.isFinite(deadline) && deadline >= now)

    return upcoming.length > 0 ? Math.min(...upcoming) : null
  }, [now, visibleSections])
  const selectedDateLabel = selectedDate
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(`${selectedDate}T12:00:00Z`))
    : null

  const beginTaskGlow = useCallback((questId: string) => {
    if (glowTimer.current !== null) window.clearTimeout(glowTimer.current)
    setGlowingQuestId(questId)
    glowTimer.current = window.setTimeout(() => {
      setGlowingQuestId((current) => (current === questId ? null : current))
      glowTimer.current = null
    }, 1_000)
  }, [])

  useEffect(() => {
    function handleCompletionUndo(event: Event) {
      const detail = (event as CustomEvent<TaskCompletionUndoEventDetail>)
        .detail
      if (!detail?.questId) return

      setOptimisticallyReopened((current) => {
        const next = new Map(current)
        if (detail.phase === "failed") {
          next.delete(detail.questId)
        } else {
          next.set(detail.questId, detail.version ?? null)
        }
        return next
      })

      if (detail.phase === "started") beginTaskGlow(detail.questId)
    }

    window.addEventListener(taskCompletionUndoEvent, handleCompletionUndo)
    return () =>
      window.removeEventListener(taskCompletionUndoEvent, handleCompletionUndo)
  }, [beginTaskGlow])

  useEffect(() => {
    function handleFocusRequest(event: Event) {
      const questId = (event as CustomEvent<unknown>).detail
      if (typeof questId === "string") beginTaskGlow(questId)
    }

    window.addEventListener(focusTodayTaskEvent, handleFocusRequest)
    return () => {
      window.removeEventListener(focusTodayTaskEvent, handleFocusRequest)
      if (glowTimer.current !== null) window.clearTimeout(glowTimer.current)
    }
  }, [beginTaskGlow])

  useEffect(() => {
    if (nextDeadline === null) return

    const maximumDelay = 2_147_000_000
    const delay = Math.min(Math.max(nextDeadline - now + 150, 0), maximumDelay)
    const timeout = window.setTimeout(() => {
      setNow(Date.now())
      if (Date.now() >= nextDeadline) router.refresh()
    }, delay)

    return () => window.clearTimeout(timeout)
  }, [nextDeadline, now, router])

  useEffect(() => {
    if (!focusedQuestId) {
      lastFocusedQuestId.current = null
      return
    }
    if (lastFocusedQuestId.current === focusedQuestId) {
      return
    }
    const isEditing =
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement ||
      (document.activeElement instanceof HTMLElement &&
        document.activeElement.isContentEditable)
    if (isEditing) {
      return
    }

    const task = document.getElementById(todayTaskElementId(focusedQuestId))
    if (!task) return

    lastFocusedQuestId.current = focusedQuestId

    const frame = window.requestAnimationFrame(() => {
      beginTaskGlow(focusedQuestId)
      const reducedMotion =
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
      task.scrollIntoView?.({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "center",
      })
      task.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [beginTaskGlow, focusedQuestId, visibleSections])

  const deleteStarted = useCallback((task: DeletedTaskNotice) => {
    setOptimisticallyDeletedIds((current) => {
      const next = new Set(current)
      next.add(task.id)
      return next
    })
    setDeletedTask(task)
  }, [])

  const deleteFailed = useCallback((questId: string) => {
    setOptimisticallyDeletedIds((current) => {
      const next = new Set(current)
      next.delete(questId)
      return next
    })
    setDeletedTask((current) => (current?.id === questId ? null : current))
  }, [])

  return (
    <TodayTaskContext.Provider
      value={{ onClassified, onRescheduled: setRescheduledTask, timezone }}
    >
      {rescheduledTask ? (
        <TaskRescheduledPopup
          onDismiss={() => setRescheduledTask(null)}
          task={rescheduledTask}
        />
      ) : null}
      {deletedTask ? (
        <TaskDeletedPopup
          onDismiss={() => setDeletedTask(null)}
          task={deletedTask}
        />
      ) : null}
      {empty ? (
        <section className="today-empty" data-historical={historical}>
          <span aria-hidden="true" className="today-empty__visual">
            <CalendarCheck2 />
            <span />
          </span>
          <div className="today-empty__copy">
            <span className="today-empty__eyebrow">
              {historical ? "Daily archive" : "Your day is clear"}
            </span>
            <h2>
              {historical
                ? "No recorded activity on this date."
                : "No active tasks for this date."}
            </h2>
            <p>
              {historical
                ? selectedDateLabel
                  ? `Tasks completed or missed on ${selectedDateLabel} will appear here.`
                  : "Completed or missed tasks for this date will appear here."
                : "Start with one focused task and give your day a clear direction."}
            </p>
          </div>
          {!historical ? (
            <Link className="today-empty__create" href="/quests">
              <Plus aria-hidden="true" />
              Create task
            </Link>
          ) : null}
          {!historical ? (
            <div className="today-empty__history">
              <History aria-hidden="true" />
              <p>
                Completed tasks and recent history stay just below your active
                work.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}
      {visibleSections.map((section) => {
        if (section.title === "Recently deleted")
          return (
            <HomeDeletedRows
              key={section.title}
              cards={section.cards}
              timezone={timezone}
              referenceNow={referenceNow ?? new Date(now).toISOString()}
            />
          )
        const isCompletedSection =
          section.title === "Completed today" || section.title === "Completed"

        return isCompletedSection ? (
          <TodayCompletedSection
            focusedQuestId={focusedQuestId}
            glowingQuestId={glowingQuestId}
            historical={historical}
            key={section.title}
            now={now}
            onCompleted={showCompletion}
            onDeleteFailed={deleteFailed}
            onDeleteStarted={deleteStarted}
            section={section}
          />
        ) : (
          <section
            className="today-section"
            data-primary={section.title === "My tasks"}
            key={section.title}
          >
            <div className="today-section__heading">
              <div>
                {section.title === "My tasks" ? (
                  <small>Personal schedule</small>
                ) : null}
                <h2 className="today-section__title">{section.title}</h2>
              </div>
              <span>
                {section.cards.length}{" "}
                {section.cards.length === 1 ? "task" : "tasks"}
              </span>
            </div>
            <div className="today-section__cards">
              {section.cards.map((card) => (
                <TodayTaskCard
                  card={card}
                  focused={card.id === focusedQuestId}
                  glowing={card.id === glowingQuestId}
                  historical={historical}
                  key={`${card.id}:${card.version}:${
                    optimisticallyReopened.get(card.id) === null
                      ? "reopening"
                      : "ready"
                  }`}
                  now={now}
                  onCompleted={showCompletion}
                  onDeleteFailed={deleteFailed}
                  onDeleteStarted={deleteStarted}
                  reopening={optimisticallyReopened.get(card.id) === null}
                />
              ))}
            </div>
          </section>
        )
      })}
    </TodayTaskContext.Provider>
  )
}

function TodayCompletedSection({
  focusedQuestId,
  glowingQuestId,
  historical,
  now,
  onCompleted,
  onDeleteFailed,
  onDeleteStarted,
  section,
}: Readonly<{
  focusedQuestId?: string | undefined
  glowingQuestId: string | null
  historical: boolean
  now: number
  onCompleted: (task: CompletedTaskNotice) => void
  onDeleteFailed: (questId: string) => void
  onDeleteStarted: (task: DeletedTaskNotice) => void
  section: TodaySection
}>) {
  const [collapsed, setCollapsed] = useState(false)
  const { timezone } = useContext(TodayTaskContext)
  const completionDate = (card: TodayCard) =>
    card.completedAt
      ? new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: timezone,
        }).format(new Date(card.completedAt))
      : null

  return (
    <section
      className="today-section today-section--completed"
      data-collapsed={collapsed}
    >
      <button
        aria-expanded={!collapsed}
        aria-label={`${section.title}, ${section.cards.length} ${
          section.cards.length === 1 ? "task" : "tasks"
        }`}
        className="today-section__heading today-section__heading--collapsible"
        onClick={() => setCollapsed((prev) => !prev)}
        type="button"
      >
        <div className="today-section__heading-title-group">
          <h2 className="today-section__title">{section.title}</h2>
        </div>
        <span className="today-section__count-badge">
          <span>
            {section.cards.length}{" "}
            {section.cards.length === 1 ? "task" : "tasks"}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`today-section__chevron ${
              collapsed ? "today-section__chevron--collapsed" : ""
            }`}
          />
        </span>
      </button>
      {!collapsed ? (
        <div className="today-section__cards">
          {section.cards.map((card, index) => (
            <Fragment key={card.id}>
              {completionDate(card) &&
              (index === 0 ||
                completionDate(section.cards[index - 1]!) !==
                  completionDate(card)) ? (
                <h3 className="home-history-date">{completionDate(card)}</h3>
              ) : null}
              <TodayTaskCard
                card={card}
                focused={card.id === focusedQuestId}
                glowing={card.id === glowingQuestId}
                historical={historical}
                key={`${card.id}:${card.version}`}
                now={now}
                onCompleted={onCompleted}
                onDeleteFailed={onDeleteFailed}
                onDeleteStarted={onDeleteStarted}
              />
            </Fragment>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function TodayTaskCard({
  card,
  focused,
  glowing,
  historical,
  now,
  onCompleted,
  onDeleteFailed,
  onDeleteStarted,
  reopening = false,
}: Readonly<{
  card: TodayCard
  focused: boolean
  glowing: boolean
  historical: boolean
  now: number
  onCompleted: (task: CompletedTaskNotice) => void
  onDeleteFailed: (questId: string) => void
  onDeleteStarted: (task: DeletedTaskNotice) => void
  reopening?: boolean | undefined
}>) {
  const { timezone, onClassified, onRescheduled } = useContext(TodayTaskContext)
  const [pending, startTransition] = useTransition()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [done, setDone] = useState(false)
  const [isDiscarding, setIsDiscarding] = useState(false)
  const router = useRouter()
  const Icon = priorityIcon[card.priority]
  const dueTime = card.dueAt ? new Date(card.dueAt).getTime() : null
  const completed = card.status === "completed"
  const missed =
    card.status === "failed" ||
    (card.status === "open" && dueTime !== null && dueTime < now)
  const hasDescription = Boolean(card.description?.trim())

  function complete() {
    if (pending || done) {
      return
    }

    triggerHaptic("success")
    setDone(true)
    startTransition(async () => {
      const result = await completeQuestAction({
        expectedVersion: card.version,
        questId: card.id,
      })

      if (result.ok) {
        const progression = result.data.progression
        onCompleted({
          currentStreak: progression?.currentStreak,
          id: result.data.id,
          streakIncreased: progression?.streakIncreased,
          title: card.title,
          timezone: progression?.timezone,
          version: result.data.version,
          xpEarned: progression?.xpDelta ?? 0,
        })

        if (focused) {
          const nextUrl = new URL(window.location.href)
          nextUrl.searchParams.delete("task")
          router.replace(
            `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}` as Route,
            { scroll: false },
          )
        } else {
          router.refresh()
        }
      } else {
        setDone(false)
        toast.error(result.error.message)
      }
    })
  }

  function moveTaskToTrash(kind: DeletedTaskNotice["kind"]) {
    if (isDiscarding) return
    triggerHaptic("heavy")

    // Remove the card/empty section and open the trash confirmation in the
    // click frame. The network mutation then confirms or rolls this back.
    flushSync(() => {
      setIsDiscarding(true)
      onDeleteStarted({ id: card.id, kind, title: card.title })
    })

    void (async () => {
      try {
        const result = await softDeleteQuestAction({
          expectedVersion: card.version,
          questId: card.id,
        })

        if (!result.ok) {
          onDeleteFailed(card.id)
          toast.error(result.error.message)
          return
        }
      } catch {
        onDeleteFailed(card.id)
        toast.error("The task could not be moved to Trash. Refresh and retry.")
      }
    })()
  }

  return (
    <div
      className="today-card-shell"
      data-details-open={detailsOpen}
      data-discarding={isDiscarding}
      data-flippable={hasDescription}
    >
      <article
        aria-label={detailsOpen ? `${card.title} description` : card.title}
        aria-busy={pending || isDiscarding || reopening}
        className="today-card"
        data-discarding={isDiscarding}
        data-done={done}
        data-glowing={glowing}
        data-pending={pending}
        data-priority={card.priority}
        data-reopening={reopening}
        data-status={missed ? "failed" : card.status}
        id={todayTaskElementId(card.id)}
        tabIndex={-1}
      >
        <div className="today-card__flipper">
          <div
            aria-hidden={detailsOpen}
            className="today-card__front"
            inert={detailsOpen}
          >
            <span aria-hidden="true" className="today-card__icon">
              <Icon />
            </span>
            <div className="today-card__body">
              <div className="today-card__copy">
                <div className="today-card__heading-line">
                  <p className="today-card__title">{card.title}</p>
                  <span className="today-card__heading-actions">
                    {hasDescription ? (
                      <button
                        aria-label={`View description for ${card.title}`}
                        className="today-card__details-trigger"
                        onClick={() => {
                          setDetailsOpen(true)
                        }}
                        title="View note"
                        type="button"
                      >
                        <MessageSquareText aria-hidden="true" />
                        <span>Note</span>
                      </button>
                    ) : null}
                    {completed ? (
                      <span className="today-card__completed">Completed</span>
                    ) : missed ? (
                      <span className="today-card__missed">Missed</span>
                    ) : (
                      <span className="today-card__priority">
                        {card.priority}
                      </span>
                    )}
                  </span>
                </div>
              </div>
              {!completed && !missed && !reopening ? (
                <TaskClassificationControl
                  card={card}
                  onClassified={onClassified}
                  timezone={timezone}
                />
              ) : null}
              <p className="today-card__meta">
                <span className="today-card__schedule">
                  <span className="today-card__date">
                    <CalendarDays aria-hidden="true" />
                    <span>{card.dateLabel ?? "No fixed date"}</span>
                  </span>
                  <span className="today-card__time">
                    <Clock3 aria-hidden="true" />
                    <span>{card.timeLabel}</span>
                  </span>
                </span>
                {card.steps > 0 ? (
                  <span className="today-card__facets">
                    <span className="today-card__steps">
                      {card.steps} steps
                    </span>
                  </span>
                ) : null}
              </p>
              {missed ? (
                <RestoreQuestScheduleDialog
                  input={{ questId: card.id, expectedVersion: card.version }}
                  mode="reschedule"
                  onRestored={(task) => onRescheduled?.(task)}
                  timezone={timezone}
                  title={card.title}
                  triggerClassName="today-card__reschedule-btn"
                />
              ) : null}
            </div>
            {completed ? (
              <span
                aria-label={`${card.title} completed`}
                className="today-card__done"
              >
                <CircleCheckBig aria-hidden="true" />
              </span>
            ) : missed ? (
              historical ? (
                <span
                  aria-label={`${card.title} missed`}
                  className="today-card__failed"
                >
                  <CircleX aria-hidden="true" />
                </span>
              ) : (
                <button
                  aria-label={`Move missed task ${card.title} to Trash`}
                  className="today-card__discard"
                  data-discarding={isDiscarding}
                  disabled={isDiscarding}
                  onClick={() => moveTaskToTrash("missed")}
                  title="Move to Trash"
                  type="button"
                >
                  <Trash2 aria-hidden="true" />
                </button>
              )
            ) : (
              <button
                aria-label={`Clear ${card.title}`}
                className="today-card__check"
                data-done={done}
                disabled={pending || done || reopening}
                onClick={complete}
                type="button"
              >
                <Check aria-hidden="true" />
              </button>
            )}
          </div>
          {hasDescription ? (
            <div
              aria-hidden={!detailsOpen}
              className="today-card__back"
              inert={!detailsOpen}
            >
              <div className="today-card__note-heading">
                <span className="today-card__note-label">
                  <MessageSquareText aria-hidden="true" />
                  <span>
                    <small>Task note</small>
                    <strong>{card.title}</strong>
                  </span>
                </span>
                <button
                  aria-label={`Return to ${card.title}`}
                  className="today-card__details-back"
                  onClick={() => setDetailsOpen(false)}
                  type="button"
                >
                  <Undo2 aria-hidden="true" />
                  Back
                </button>
              </div>
              <p className="today-card__note-copy">{card.description}</p>
            </div>
          ) : null}
        </div>
      </article>
    </div>
  )
}
