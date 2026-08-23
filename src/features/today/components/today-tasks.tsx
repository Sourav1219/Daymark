"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react"
import type { Route } from "next"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CalendarDays,
  CalendarCheck2,
  Check,
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
import { type CompletedTaskNotice } from "@/features/quests/components/task-completed-popup"
import { useTaskCompletionCelebration } from "@/features/quests/components/task-completion-celebration-provider"
import type { QuestPriority } from "@/features/quests/domain/types"
import {
  focusTodayTaskEvent,
  todayTaskElementId,
} from "@/features/quests/domain/quest-links"
import type { TodayCard, TodaySection } from "@/features/today/types"

const priorityIcon: Record<QuestPriority, LucideIcon> = {
  critical: Flame,
  high: Zap,
  low: Circle,
  medium: Star,
}
const swipeRevealWidth = 70
const detailSwipeThreshold = 52

type TodayTasksProps = Readonly<{
  empty: boolean
  focusedQuestId?: string | undefined
  historical?: boolean
  referenceNow?: string
  selectedDate?: string
  sections: readonly TodaySection[]
}>

export function TodayTasks({
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
  const [glowingQuestId, setGlowingQuestId] = useState<string | null>(null)
  const [now, setNow] = useState(() =>
    referenceNow ? new Date(referenceNow).getTime() : Date.now(),
  )
  const nextDeadline = useMemo(() => {
    const upcoming = sections
      .flatMap(({ cards }) => cards)
      .filter(({ status }) => status === "open")
      .map(({ dueAt }) => (dueAt ? new Date(dueAt).getTime() : Number.NaN))
      .filter((deadline) => Number.isFinite(deadline) && deadline >= now)

    return upcoming.length > 0 ? Math.min(...upcoming) : null
  }, [now, sections])
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
    const task = document.getElementById(todayTaskElementId(focusedQuestId))
    if (!task) return
    if (
      lastFocusedQuestId.current === focusedQuestId &&
      document.activeElement === task
    ) {
      return
    }
    beginTaskGlow(focusedQuestId)

    const frame = window.requestAnimationFrame(() => {
      const reducedMotion =
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
      task.scrollIntoView?.({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "center",
      })
      task.focus({ preventScroll: true })
      lastFocusedQuestId.current = focusedQuestId
    })

    return () => window.cancelAnimationFrame(frame)
  }, [beginTaskGlow, focusedQuestId, sections])

  return (
    <>
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
              <p>Finished tasks stay safely in Cleared and Progress.</p>
            </div>
          ) : null}
        </section>
      ) : null}
      {sections.map((section) => (
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
                key={`${card.id}:${card.version}`}
                now={now}
                onCompleted={showCompletion}
                onDeleted={setDeletedTask}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

function TodayTaskCard({
  card,
  focused,
  glowing,
  historical,
  now,
  onCompleted,
  onDeleted,
}: Readonly<{
  card: TodayCard
  focused: boolean
  glowing: boolean
  historical: boolean
  now: number
  onCompleted: (task: CompletedTaskNotice) => void
  onDeleted: (task: DeletedTaskNotice) => void
}>) {
  const [pending, startTransition] = useTransition()
  const [discardPending, startDiscard] = useTransition()
  const [actionsOpen, setActionsOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailSwipeOffset, setDetailSwipeOffset] = useState(0)
  const [done, setDone] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [removed, setRemoved] = useState(false)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const swipeOffsetRef = useRef(0)
  const swipeStart = useRef<{
    detailsOpen: boolean
    gesture: "delete" | "details" | null
    offset: number
    pointerId: number
    x: number
    y: number
  } | null>(null)
  const router = useRouter()
  const Icon = priorityIcon[card.priority]
  const dueTime = card.dueAt ? new Date(card.dueAt).getTime() : null
  const completed = card.status === "completed"
  const missed =
    card.status === "failed" ||
    (card.status === "open" && dueTime !== null && dueTime < now)
  const cancellable = !historical && card.status === "open" && !missed
  const hasDescription = Boolean(card.description?.trim())

  function settleSwipe(open: boolean) {
    const offset = open ? -swipeRevealWidth : 0
    swipeOffsetRef.current = offset
    setSwipeOffset(offset)
    setActionsOpen(open)
    setDragging(false)
  }

  function beginSwipe(event: ReactPointerEvent<HTMLElement>) {
    if ((!cancellable && !hasDescription) || discardPending || pending) return
    if ((event.target as Element).closest("button")) return

    swipeStart.current = {
      detailsOpen,
      gesture: actionsOpen ? "delete" : null,
      offset: swipeOffsetRef.current,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    }
    setDragging(true)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function moveSwipe(event: ReactPointerEvent<HTMLElement>) {
    const start = swipeStart.current
    if (!start || start.pointerId !== event.pointerId) return

    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
      swipeStart.current = null
      setDetailSwipeOffset(0)
      settleSwipe(actionsOpen)
      return
    }
    if (Math.abs(deltaX) < 4) return

    if (!start.gesture) {
      if (
        hasDescription &&
        ((start.detailsOpen && deltaX < 0) ||
          (!start.detailsOpen && deltaX > 0))
      ) {
        start.gesture = "details"
      } else if (!start.detailsOpen && cancellable && deltaX < 0) {
        start.gesture = "delete"
      } else {
        return
      }
    }

    event.preventDefault()
    if (start.gesture === "details") {
      const direction = start.detailsOpen ? -1 : 1
      const distance = Math.max(direction * deltaX, 0)
      setDetailSwipeOffset(direction * Math.min(distance * 0.28, 22))
      return
    }

    const offset = Math.max(
      -swipeRevealWidth,
      Math.min(0, start.offset + deltaX),
    )
    swipeOffsetRef.current = offset
    setSwipeOffset(offset)
  }

  function finishSwipe(event: ReactPointerEvent<HTMLElement>) {
    const start = swipeStart.current
    if (!start || start.pointerId !== event.pointerId) return

    swipeStart.current = null
    if (start.gesture === "details") {
      const deltaX = event.clientX - start.x
      const direction = start.detailsOpen ? -1 : 1
      const shouldFlip = direction * deltaX >= detailSwipeThreshold
      setDetailSwipeOffset(0)
      setDragging(false)
      if (shouldFlip) setDetailsOpen(!start.detailsOpen)
      return
    }

    settleSwipe(swipeOffsetRef.current <= -swipeRevealWidth / 2)
  }

  function complete() {
    if (pending || done) {
      return
    }

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
        }
      } else {
        setDone(false)
        toast.error(result.error.message)
      }
    })
  }

  function moveTaskToTrash(kind: DeletedTaskNotice["kind"]) {
    if (discardPending || removed) return

    startDiscard(async () => {
      try {
        const result = await softDeleteQuestAction({
          expectedVersion: card.version,
          questId: card.id,
        })

        if (!result.ok) {
          toast.error(result.error.message)
          return
        }

        setRemoved(true)
        onDeleted({ id: result.data.id, kind, title: card.title })
        router.refresh()
      } catch {
        toast.error("The task could not be moved to Trash. Refresh and retry.")
      }
    })
  }

  if (removed) return null

  return (
    <div
      className="today-card-shell"
      data-actions-open={actionsOpen}
      data-details-open={detailsOpen}
      data-dragging={dragging}
      data-flippable={hasDescription}
      data-swipeable={cancellable}
      style={
        {
          "--detail-swipe-offset": `${detailSwipeOffset}px`,
          "--swipe-offset": `${swipeOffset}px`,
        } as CSSProperties
      }
    >
      <article
        aria-label={detailsOpen ? `${card.title} description` : card.title}
        aria-busy={pending || discardPending}
        className="today-card"
        data-done={done}
        data-glowing={glowing}
        data-pending={pending}
        data-priority={card.priority}
        data-status={missed ? "failed" : card.status}
        id={todayTaskElementId(card.id)}
        onPointerCancel={finishSwipe}
        onPointerDown={beginSwipe}
        onPointerMove={moveSwipe}
        onPointerUp={finishSwipe}
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
                          settleSwipe(false)
                          setDetailsOpen(true)
                        }}
                        title="View note · or swipe right"
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
                  disabled={discardPending}
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
                disabled={pending || done}
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
              <span className="today-card__note-hint">
                Swipe left to return
              </span>
            </div>
          ) : null}
        </div>
      </article>
      {cancellable ? (
        <button
          aria-label={`Move ${card.title} to Trash`}
          className="today-card__swipe-delete"
          disabled={discardPending}
          onClick={() => moveTaskToTrash("cancelled")}
          onFocus={() => settleSwipe(true)}
          type="button"
        >
          <span aria-hidden="true" className="today-card__swipe-delete-icon">
            <Trash2 />
          </span>
          <span>{discardPending ? "Moving…" : "Remove"}</span>
        </button>
      ) : null}
    </div>
  )
}
