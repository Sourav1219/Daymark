"use client"

import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { flushSync } from "react-dom"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, Check, Clock3, Inbox } from "lucide-react"

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
  locallyReadDeadlineIds: ReadonlySet<string>
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
  const storedDeadlineSnapshot = useSyncExternalStore(
    subscribeToReadDeadlines,
    readStoredDeadlineSnapshot,
    () => "[]",
  )
  const locallyReadDeadlineIds = useMemo<ReadonlySet<string>>(() => {
    try {
      const ids: unknown = JSON.parse(storedDeadlineSnapshot)
      return new Set(
        Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [],
      )
    } catch {
      return new Set()
    }
  }, [storedDeadlineSnapshot])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now())
      router.refresh()
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [router])

  const dueSoonQuests = inbox.dueSoonQuests.filter((quest) => {
    const remaining = new Date(quest.dueAt).getTime() - now
    return remaining > 0 && remaining < deadlineWindowMs
  })
  const unreadDeadlines = dueSoonQuests.filter(
    (quest) => !locallyReadDeadlineIds.has(deadlineAlertId(quest)),
  )

  function rememberDeadlineIds(ids: readonly string[]) {
    const next = new Set(locallyReadDeadlineIds)
    for (const id of ids) next.add(id)
    storeReadDeadlineIds(next)
  }

  function markAllRead() {
    const deadlineIds = unreadDeadlines.map(deadlineAlertId)
    if (deadlineIds.length) rememberDeadlineIds(deadlineIds)
  }

  return {
    dueSoonQuests,
    locallyReadDeadlineIds,
    markAllRead,
    markDeadlineRead: (id) => rememberDeadlineIds([id]),
    now,
    unreadCount: unreadDeadlines.length,
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
  const { dueSoonQuests, locallyReadDeadlineIds, markDeadlineRead, now } =
    controller

  if (!dueSoonQuests.length) {
    if (compact) {
      return (
        <div className="grid justify-items-center gap-1 py-4 text-center text-ink-muted">
          <Inbox aria-hidden="true" className="size-5 text-system-blue/70" />
          <p className="text-sm font-bold text-ink">
            You&apos;re all caught up
          </p>
          <p className="text-xs">Nothing needs your attention right now.</p>
        </div>
      )
    }

    return (
      <div className="grid justify-items-center gap-2 py-8 text-center text-ink-muted">
        <Inbox aria-hidden="true" className="size-7" />
        <p className="text-sm font-medium text-ink">
          You&apos;re all caught up
        </p>
        <p className="max-w-sm text-xs leading-relaxed">
          Open tasks with less than 30 minutes remaining will appear here.
        </p>
      </div>
    )
  }

  return (
    <ul
      aria-label="Reminder inbox"
      className={cn(
        "grid gap-2",
        compact && "max-h-72 gap-1.5 overflow-y-auto pr-1",
      )}
    >
      {dueSoonQuests.map((quest) => {
        const alertId = deadlineAlertId(quest)
        const isRead = locallyReadDeadlineIds.has(alertId)

        return (
          <li
            className={cn(
              "rounded-control border bg-surface-inset p-3",
              isRead ? "border-border-soft" : "border-system-blue/25",
              compact && "p-2.5",
            )}
            key={alertId}
          >
            <article aria-label={`${quest.title} deadline alert`}>
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-system-blue/10 text-system-blue"
                >
                  <Clock3 className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-ink">{quest.title}</p>
                    {!isRead ? (
                      <span className="mt-1 size-2 shrink-0 rounded-full bg-system-blue">
                        <span className="sr-only">Unread</span>
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-system-blue">
                    {deadlineMessage(quest.dueAt, now)}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Due{" "}
                    <time dateTime={quest.dueAt}>
                      {formatZonedDateTime(new Date(quest.dueAt), timezone)}
                    </time>
                  </p>
                </div>
              </div>
              <div
                className={cn(
                  "mt-3 flex flex-wrap gap-2 pl-11",
                  compact && "mt-2 pl-10",
                )}
              >
                <Button asChild size="sm" variant="outline">
                  <Link
                    href={questHomeHref(
                      quest.id,
                      localDateForInstant(new Date(quest.dueAt), timezone),
                    )}
                    onClick={() => onOpenTask?.(quest.id)}
                  >
                    Open task
                  </Link>
                </Button>
                {!isRead ? (
                  <Button
                    onClick={() => markDeadlineRead(alertId)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Check aria-hidden="true" /> Mark read
                  </Button>
                ) : null}
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
        "flex items-center justify-between gap-3",
        compact && "justify-end",
      )}
    >
      {!compact ? (
        <p aria-live="polite" className="text-xs font-medium text-ink-muted">
          {controller.unreadCount
            ? `${controller.unreadCount} unread ${controller.unreadCount === 1 ? "alert" : "alerts"}`
            : "No unread alerts"}
        </p>
      ) : null}
      {controller.unreadCount ? (
        <Button
          onClick={controller.markAllRead}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Check aria-hidden="true" /> Mark all read
        </Button>
      ) : null}
    </div>
  )
}

export function ReminderInboxPanel(props: ReminderInboxProps) {
  const controller = useReminderInbox(props)

  return (
    <div className="grid gap-3">
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
          className="today-notification-button relative size-10"
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
        className="w-[min(19.5rem,calc(100vw-1.5rem))] gap-3 rounded-[18px] border border-white bg-white p-3 shadow-[0_18px_45px_-18px_rgba(34,62,128,0.42)]"
        sideOffset={10}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border-soft pb-2.5">
          <div>
            <h2
              className="text-sm font-extrabold text-ink"
              id="notification-popover-title"
            >
              Notifications
            </h2>
            <p
              className="mt-0.5 text-xs text-ink-muted"
              id="notification-popover-description"
            >
              Tasks ending soon
            </p>
          </div>
          <span className="rounded-full bg-system-blue/10 px-2 py-1 text-[0.68rem] font-bold text-system-blue">
            {controller.unreadCount
              ? `${controller.unreadCount} new`
              : "All read"}
          </span>
        </div>
        <InboxToolbar compact controller={controller} />
        <InboxList
          compact
          controller={controller}
          onOpenTask={closeAndFocusTask}
          timezone={props.timezone}
        />
      </PopoverContent>
    </Popover>
  )
}
