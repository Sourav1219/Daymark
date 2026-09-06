"use client"

import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { flushSync } from "react-dom"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowUpRight,
  Bell,
  Check,
  CheckCheck,
  Clock3,
  Inbox,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  focusTodayTaskEvent,
  questHomeHref,
  todayTaskElementId,
} from "@/features/quests/domain/quest-links"
import { localDateForInstant } from "@/features/progression/domain/progression"
import { deadlineMessage } from "@/features/reminders/domain/deadline-message"
import type {
  DueSoonQuestView,
  ReminderInboxData,
} from "@/features/reminders/domain/types"
import { formatZonedDateTime } from "@/features/reminders/domain/timezone"
import {
  cookieConsentChangedEvent,
  hasPreferenceStorageConsent,
  readDeadlineStorageKey,
} from "@/features/privacy/client/optional-browser-storage"
import { cn } from "@/lib/utils"

const readDeadlineStorageEvent = "questly:read-deadline-alerts-changed"
const deadlineWindowMs = 30 * 60_000

type InboxController = Readonly<{
  dueSoonQuests: readonly DueSoonQuestView[]
  markAllRead: () => void
  markDeadlineRead: (id: string) => void
  now: number
  unreadCount: number
}>

type ReminderInboxProps = Readonly<{
  inbox: ReminderInboxData
  referenceNow: string
  timezone: string
}>

function deadlineAlertId(quest: DueSoonQuestView): string {
  return `${quest.id}:${quest.dueAt}`
}

function readStoredDeadlineSnapshot(): string {
  if (typeof window === "undefined" || !hasPreferenceStorageConsent())
    return "[]"

  try {
    const stored = window.localStorage.getItem(readDeadlineStorageKey)
    return stored ?? "[]"
  } catch {
    return "[]"
  }
}

function storeReadDeadlineIds(ids: ReadonlySet<string>) {
  if (!hasPreferenceStorageConsent()) return

  try {
    window.localStorage.setItem(
      readDeadlineStorageKey,
      JSON.stringify(Array.from(ids).slice(-100)),
    )
    window.dispatchEvent(new Event(readDeadlineStorageEvent))
  } catch {
    // The inbox remains usable when storage is blocked or unavailable.
  }
}

function subscribeToReadDeadlines(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange)
  window.addEventListener(readDeadlineStorageEvent, onStoreChange)
  window.addEventListener(cookieConsentChangedEvent, onStoreChange)
  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(readDeadlineStorageEvent, onStoreChange)
    window.removeEventListener(cookieConsentChangedEvent, onStoreChange)
  }
}

function useReminderInbox({
  inbox,
  referenceNow,
}: Pick<ReminderInboxProps, "inbox" | "referenceNow">): InboxController {
  const router = useRouter()
  const [now, setNow] = useState(() => new Date(referenceNow).getTime())
  const [sessionReadDeadlineIds, setSessionReadDeadlineIds] = useState<
    ReadonlySet<string>
  >(() => new Set())
  const storedDeadlineSnapshot = useSyncExternalStore(
    subscribeToReadDeadlines,
    readStoredDeadlineSnapshot,
    () => "[]",
  )
  const storedReadDeadlineIds = useMemo<ReadonlySet<string>>(() => {
    try {
      const ids: unknown = JSON.parse(storedDeadlineSnapshot)
      return new Set(
        Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [],
      )
    } catch {
      return new Set()
    }
  }, [storedDeadlineSnapshot])
  const readDeadlineIds = useMemo(
    () => new Set([...storedReadDeadlineIds, ...sessionReadDeadlineIds]),
    [sessionReadDeadlineIds, storedReadDeadlineIds],
  )

  useEffect(() => {
    // Local tick only. This keeps countdown copy live and costs nothing — it
    // must not trigger a server round trip.
    const tickTimer = window.setInterval(() => setNow(Date.now()), 30_000)

    // Refresh only on a real user return to the tab. Keeping a tab visible no
    // longer creates periodic server renders.
    function refreshWhenVisible() {
      if (document.visibilityState !== "visible") return
      setNow(Date.now())
      router.refresh()
    }

    document.addEventListener("visibilitychange", refreshWhenVisible)

    return () => {
      window.clearInterval(tickTimer)
      document.removeEventListener("visibilitychange", refreshWhenVisible)
    }
  }, [router])

  const activeDueSoonQuests = inbox.dueSoonQuests.filter((quest) => {
    const remaining = new Date(quest.dueAt).getTime() - now
    return remaining > 0 && remaining < deadlineWindowMs
  })
  const dueSoonQuests = activeDueSoonQuests.filter(
    (quest) => !readDeadlineIds.has(deadlineAlertId(quest)),
  )

  function rememberDeadlineIds(ids: readonly string[]) {
    const next = new Set(readDeadlineIds)
    for (const id of ids) next.add(id)
    setSessionReadDeadlineIds(next)
    storeReadDeadlineIds(next)
  }

  function markAllRead() {
    const deadlineIds = dueSoonQuests.map(deadlineAlertId)
    if (deadlineIds.length) rememberDeadlineIds(deadlineIds)
  }

  return {
    dueSoonQuests,
    markAllRead,
    markDeadlineRead: (id) => rememberDeadlineIds([id]),
    now,
    unreadCount: dueSoonQuests.length,
  }
}

function InboxList({
  compact = false,
  controller,
  onOpenTask,
  timezone,
}: Readonly<{
  compact?: boolean
  controller: InboxController
  onOpenTask?: ((questId: string) => void) | undefined
  timezone: string
}>) {
  const { dueSoonQuests, markDeadlineRead, now } = controller

  if (!dueSoonQuests.length) {
    if (compact) {
      return (
        <div className="notification-empty notification-empty--compact">
          <span className="notification-empty__icon">
            <Inbox aria-hidden="true" />
          </span>
          <p>You&apos;re all caught up</p>
          <small>Nothing needs your attention right now.</small>
        </div>
      )
    }

    return (
      <div className="notification-empty">
        <span className="notification-empty__icon">
          <Inbox aria-hidden="true" />
        </span>
        <p>You&apos;re all caught up</p>
        <small>
          Open tasks with less than 30 minutes remaining will appear here.
        </small>
      </div>
    )
  }

  return (
    <ul
      aria-label="Reminder inbox"
      className={cn(
        "notification-list",
        compact && "notification-list--compact",
      )}
    >
      {dueSoonQuests.map((quest) => {
        const alertId = deadlineAlertId(quest)

        return (
          <li
            className={cn(
              "notification-item notification-item--unread",
              compact && "notification-item--compact",
            )}
            key={alertId}
          >
            <article aria-label={`${quest.title} deadline alert`}>
              <div className="notification-item__body">
                <span aria-hidden="true" className="notification-item__clock">
                  <Clock3 />
                </span>
                <div className="notification-item__content">
                  <div className="notification-item__title-row">
                    <p>{quest.title}</p>
                    <span className="notification-item__unread-dot">
                      <span className="sr-only">Unread</span>
                    </span>
                  </div>
                  <p className="notification-item__deadline">
                    {deadlineMessage(quest.dueAt, now)}
                  </p>
                  <p className="notification-item__due">
                    Due{" "}
                    <time dateTime={quest.dueAt}>
                      {formatZonedDateTime(new Date(quest.dueAt), timezone)}
                    </time>
                  </p>
                </div>
              </div>
              <div
                className={cn(
                  "notification-item__actions",
                  compact && "notification-item__actions--compact",
                )}
              >
                <Button
                  asChild
                  className="notification-action notification-action--primary"
                  size="sm"
                  variant="outline"
                >
                  <Link
                    href={questHomeHref(
                      quest.id,
                      localDateForInstant(new Date(quest.dueAt), timezone),
                    )}
                    onClick={() => onOpenTask?.(quest.id)}
                  >
                    Open task <ArrowUpRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  className="notification-action notification-action--quiet"
                  onClick={() => markDeadlineRead(alertId)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Check aria-hidden="true" /> Mark read
                </Button>
              </div>
            </article>
          </li>
        )
      })}
    </ul>
  )
}

function InboxToolbar({
  compact = false,
  controller,
}: Readonly<{ compact?: boolean; controller: InboxController }>) {
  if (compact && !controller.unreadCount) return null

  return (
    <div
      className={cn(
        "notification-toolbar",
        compact && "notification-toolbar--compact",
      )}
    >
      {!compact ? (
        <p aria-live="polite">
          {controller.unreadCount
            ? `${controller.unreadCount} unread ${controller.unreadCount === 1 ? "alert" : "alerts"}`
            : "No unread alerts"}
        </p>
      ) : null}
      {controller.unreadCount ? (
        <Button
          className="notification-action notification-action--quiet"
          onClick={controller.markAllRead}
          size="sm"
          type="button"
          variant="ghost"
        >
          <CheckCheck aria-hidden="true" /> Mark all read
        </Button>
      ) : null}
    </div>
  )
}

export function ReminderInboxPanel(props: ReminderInboxProps) {
  const controller = useReminderInbox(props)

  return (
    <div className="notification-inbox-panel">
      <InboxToolbar controller={controller} />
      <InboxList controller={controller} timezone={props.timezone} />
    </div>
  )
}

export function NotificationMenu(props: ReminderInboxProps) {
  const controller = useReminderInbox(props)
  const [open, setOpen] = useState(false)

  function closeAndFocusTask(questId: string) {
    flushSync(() => setOpen(false))
    window.dispatchEvent(
      new CustomEvent(focusTodayTaskEvent, { detail: questId }),
    )
    window.requestAnimationFrame(() => {
      const task = document.getElementById(todayTaskElementId(questId))
      if (!task) return

      const reducedMotion =
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
      task.scrollIntoView?.({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "center",
      })
      task.focus({ preventScroll: true })
    })
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-label={`Open notifications${controller.unreadCount ? `, ${controller.unreadCount} unread` : ""}`}
          className="today-notification-button"
          size="icon-lg"
          type="button"
          variant="outline"
        >
          <Bell aria-hidden="true" />
          {controller.unreadCount ? (
            <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-[0.65rem] font-bold text-white">
              {Math.min(controller.unreadCount, 9)}
              {controller.unreadCount > 9 ? "+" : null}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-describedby="notification-popover-description"
        aria-labelledby="notification-popover-title"
        className="notification-popover"
        collisionPadding={10}
        sideOffset={10}
      >
        <div className="notification-popover__header">
          <span
            className="notification-popover__header-icon"
            aria-hidden="true"
          >
            <Bell />
          </span>
          <div className="notification-popover__heading">
            <div>
              <h2 id="notification-popover-title">Notifications</h2>
              <p id="notification-popover-description">Tasks ending soon</p>
            </div>
            <span className="notification-popover__status">
              {controller.unreadCount
                ? `${controller.unreadCount} new`
                : "All clear"}
            </span>
          </div>
        </div>
        <div className="notification-popover__content">
          <InboxToolbar compact controller={controller} />
          <InboxList
            compact
            controller={controller}
            onOpenTask={closeAndFocusTask}
            timezone={props.timezone}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
