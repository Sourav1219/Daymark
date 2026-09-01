"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import {
  BarChart3,
  CalendarDays,
  Check,
  Clock3,
  History,
  Pause,
  Pencil,
  Play,
  Sparkles,
  Square,
  TimerReset,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import "@/app/styles/progress-page.css"
import { getLocalDayWindow } from "@/features/quests/domain/today-window"
import {
  editTimerSubjectAction,
  pauseTimerAction,
  resumeTimerAction,
  startTimerAction,
  stopTimerAction,
} from "@/features/timer/application/actions"
import {
  activeTimerStorageKey,
  legacyActiveTimerStorageKey,
} from "@/features/timer/components/timer-lifecycle-boundary"
import { GroupStudyPanel } from "@/features/timer/components/group-study-panel"
import {
  TimerSessionPopup,
  type TimerSessionCelebration,
} from "@/features/timer/components/timer-session-popup"
import { calculateTimerElapsedMs } from "@/features/timer/domain/timer"
import type {
  TimerDashboardView,
  TimerSessionView,
} from "@/features/timer/domain/types"
import { formatDateTime } from "@/lib/formatting/date"

const secondMs = 1000
const minuteMs = 60 * secondMs

function elapsedAt(
  session: TimerSessionView,
  now: number,
  serverOffset: number,
) {
  return calculateTimerElapsedMs({
    accumulatedMs: session.accumulatedMs,
    lastStartedAt: session.lastStartedAt,
    nowMs: now + serverOffset,
    status: session.status,
  })
}

function formatClock(milliseconds: number) {
  const seconds = Math.floor(Math.max(0, milliseconds) / secondMs)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  return [hours, minutes, remainder]
    .map((value) => String(value).padStart(2, "0"))
    .join(":")
}

function TimerClockDisplay({
  milliseconds,
}: Readonly<{ milliseconds: number }>) {
  const clock = formatClock(milliseconds)
  const [hours, minutes, seconds] = clock.split(":")

  return (
    <div className="timer-clock-wrap">
      <div
        aria-label={`Elapsed time ${clock}`}
        aria-live="off"
        className="timer-clock"
        role="timer"
      >
        <span className="sr-only">{clock}</span>
        <span aria-hidden="true" className="timer-clock-unit">
          <strong>{hours}</strong>
          <small>Hours</small>
        </span>
        <span aria-hidden="true" className="timer-clock-separator">
          :
        </span>
        <span aria-hidden="true" className="timer-clock-unit">
          <strong>{minutes}</strong>
          <small>Minutes</small>
        </span>
        <span aria-hidden="true" className="timer-clock-separator">
          :
        </span>
        <span aria-hidden="true" className="timer-clock-unit">
          <strong>{seconds}</strong>
          <small>Seconds</small>
        </span>
      </div>
    </div>
  )
}

function formatCompactDuration(milliseconds: number) {
  const totalMinutes = Math.floor(milliseconds / minuteMs)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
}

function formatSessionDate(isoDate: string, timezone: string) {
  return formatDateTime(new Date(isoDate), timezone)
}

type MutationResult = Awaited<ReturnType<typeof pauseTimerAction>>
type SuccessfulMutationResult = Extract<MutationResult, { ok: true }>

export function TimerRoute({
  initialDashboard,
}: Readonly<{ initialDashboard: TimerDashboardView }>) {
  const router = useRouter()
  const [now, setNow] = useState(() => Date.now())
  const [serverOffset] = useState(
    () => Date.parse(initialDashboard.serverNow) - Date.now(),
  )
  const [subject, setSubject] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingSubject, setEditingSubject] = useState("")
  const [celebration, setCelebration] =
    useState<TimerSessionCelebration | null>(null)
  const [isPending, startTransition] = useTransition()
  const activeSession = initialDashboard.activeSession
  const sharedSession = initialDashboard.sharedSession
  const activeSessionId = activeSession?.id
  const activeElapsed = activeSession
    ? elapsedAt(activeSession, now, serverOffset)
    : 0
  const longestSessionMs = initialDashboard.history.reduce(
    (longest, session) => Math.max(longest, session.accumulatedMs),
    0,
  )
  const timerStatus = activeSession?.status ?? "ready"
  const hasRunningGroupTimer =
    sharedSession?.participants.some(
      (participant) => participant.status === "running",
    ) ?? false

  useEffect(() => {
    if (activeSession?.status !== "running" && !hasRunningGroupTimer) return
    const interval = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(interval)
  }, [activeSession?.status, hasRunningGroupTimer])

  useEffect(() => {
    const day = getLocalDayWindow(
      initialDashboard.localDate,
      initialDashboard.timezone,
    )
    if (!day) return

    const delay = Math.max(
      250,
      day.end.getTime() - (Date.now() + serverOffset) + 100,
    )
    const timeout = window.setTimeout(() => router.refresh(), delay)
    return () => window.clearTimeout(timeout)
  }, [
    initialDashboard.localDate,
    initialDashboard.timezone,
    router,
    serverOffset,
  ])

  useEffect(() => {
    if (activeSessionId) {
      window.sessionStorage.setItem(activeTimerStorageKey, activeSessionId)
      window.sessionStorage.removeItem(legacyActiveTimerStorageKey)
      return
    }
    window.sessionStorage.removeItem(activeTimerStorageKey)
    window.sessionStorage.removeItem(legacyActiveTimerStorageKey)
  }, [activeSessionId])

  const dismissCelebration = useCallback(() => setCelebration(null), [])
  const showGroupTimerCelebration = useCallback(
    (groupSubject: string) =>
      setCelebration({ kind: "started", subject: groupSubject }),
    [],
  )

  function handleResult(
    result: MutationResult,
    successMessage?: string,
  ): result is SuccessfulMutationResult {
    if (!result.ok) {
      toast.error(result.error.message)
      return false
    }
    if (successMessage) toast.success(successMessage)
    setNow(Date.now())
    router.refresh()
    return true
  }

  function startNewTimer() {
    startTransition(async () => {
      const result = await startTimerAction({ subject })
      if (!handleResult(result)) return
      setSubject("")
      setCelebration({ kind: "started", subject: result.data.subject })
    })
  }

  function finishTimer() {
    if (!activeSession) return
    startTransition(async () => {
      const result = await stopTimerAction({
        expectedVersion: activeSession.version,
        sessionId: activeSession.id,
      })
      if (!handleResult(result)) return
      setCelebration({
        durationMs: result.data.accumulatedMs,
        kind: "finished",
        subject: result.data.subject,
      })
    })
  }

  function pauseTimer() {
    if (!activeSession) return
    startTransition(async () => {
      const result = await pauseTimerAction({
        expectedVersion: activeSession.version,
        sessionId: activeSession.id,
      })
      if (!handleResult(result)) return
      setCelebration({ kind: "paused", subject: result.data.subject })
    })
  }

  function transition(action: typeof pauseTimerAction, successMessage: string) {
    if (!activeSession) return
    startTransition(async () => {
      const result = await action({
        expectedVersion: activeSession.version,
        sessionId: activeSession.id,
      })
      handleResult(result, successMessage)
    })
  }

  function saveSubject(session: TimerSessionView) {
    startTransition(async () => {
      const result = await editTimerSubjectAction({
        expectedVersion: session.version,
        sessionId: session.id,
        subject: editingSubject,
      })
      if (result.ok) setEditingId(null)
      handleResult(result, "Subject updated")
    })
  }

  return (
    <div className="timer-page">
      {celebration ? (
        <TimerSessionPopup
          celebration={celebration}
          onDismiss={dismissCelebration}
        />
      ) : null}
      <header className="timer-page-header">
        <div>
          <p className="timer-page-eyebrow">Focus timer</p>
          <h1>Timer</h1>
          <p>Give one thing your full attention.</p>
        </div>
      </header>

      <section
        aria-labelledby="focus-timer-heading"
        className="timer-focus-card"
        data-state={timerStatus}
      >
        <span
          aria-hidden="true"
          className="timer-focus-orb timer-focus-orb--one"
        />
        <span
          aria-hidden="true"
          className="timer-focus-orb timer-focus-orb--two"
        />

        <div className="timer-focus-topline">
          <div>
            <span className="timer-focus-icon">
              <TimerReset aria-hidden="true" />
            </span>
            <div>
              <p>Your focus room</p>
              <h2 id="focus-timer-heading">
                {activeSession ? "Session in progress" : "Ready when you are"}
              </h2>
            </div>
          </div>
          <span className="timer-status-pill" data-state={timerStatus}>
            <span aria-hidden="true" />
            {timerStatus === "running"
              ? "Focusing"
              : timerStatus === "paused"
                ? "Paused"
                : "Ready"}
          </span>
        </div>

        <TimerClockDisplay milliseconds={activeElapsed} />

        {activeSession ? (
          <div className="timer-active-panel">
            <div className="timer-active-label">
              <span>Focusing on</span>
              <SubjectEditor
                editing={editingId === activeSession.id}
                editingSubject={editingSubject}
                isPending={isPending}
                onCancel={() => setEditingId(null)}
                onChange={setEditingSubject}
                onEdit={() => {
                  setEditingId(activeSession.id)
                  setEditingSubject(activeSession.subject)
                }}
                onSave={() => saveSubject(activeSession)}
                session={activeSession}
                variant="hero"
              />
            </div>

            <div className="timer-controls">
              {activeSession.status === "running" ? (
                <Button
                  className="timer-control-primary"
                  disabled={isPending}
                  onClick={pauseTimer}
                  type="button"
                >
                  <Pause aria-hidden="true" /> Pause
                </Button>
              ) : (
                <Button
                  className="timer-control-primary"
                  disabled={isPending}
                  onClick={() => transition(resumeTimerAction, "Timer resumed")}
                  type="button"
                >
                  <Play aria-hidden="true" /> Resume
                </Button>
              )}
              <Button
                className="timer-control-secondary"
                disabled={isPending}
                onClick={finishTimer}
                type="button"
                variant="outline"
              >
                <Square aria-hidden="true" />
                {sharedSession ? "Stop & leave" : "Finish"}
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="timer-start-form"
            onSubmit={(event) => {
              event.preventDefault()
              startNewTimer()
            }}
          >
            <label htmlFor="timer-subject">What will you focus on?</label>
            <div>
              <Input
                aria-label="Session subject"
                autoComplete="off"
                className="timer-subject-input"
                disabled={isPending}
                id="timer-subject"
                maxLength={160}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="e.g. Read chapter four"
                required
                value={subject}
              />
              <Button
                className="timer-start-button"
                disabled={isPending}
                type="submit"
              >
                <Play aria-hidden="true" /> Start timer
              </Button>
            </div>
          </form>
        )}

        <p className="timer-background-note">
          <Sparkles aria-hidden="true" /> Keeps counting while you work in
          another tab.
        </p>
      </section>

      <GroupStudyPanel
        hasActiveTimer={Boolean(activeSession)}
        nowMs={now + serverOffset}
        onTimerStarted={showGroupTimerCelebration}
        pendingJoinRequest={initialDashboard.pendingJoinRequest}
        sharedHistory={initialDashboard.sharedHistory}
        sharedSession={sharedSession}
        timezone={initialDashboard.timezone}
      />

      <section
        aria-labelledby="timer-overview-heading"
        className="timer-overview"
      >
        <div className="timer-section-heading">
          <div>
            <p>At a glance</p>
            <h2 id="timer-overview-heading">Your focus</h2>
          </div>
          <TrendingUp aria-hidden="true" />
        </div>
        <div className="timer-metrics-grid">
          <MetricCard
            icon={Clock3}
            label="Today's focus"
            tone="blue"
            value={formatCompactDuration(initialDashboard.totalCompletedMs)}
          />
          <MetricCard
            icon={BarChart3}
            label="Sessions"
            tone="violet"
            value={String(initialDashboard.completedCount)}
          />
          <MetricCard
            icon={TrendingUp}
            label="Best session"
            tone="cyan"
            value={formatCompactDuration(longestSessionMs)}
          />
        </div>
      </section>

      <section
        aria-labelledby="timer-history-heading"
        className="timer-history-section"
      >
        <div className="timer-section-heading">
          <div>
            <p>Today&apos;s focus record</p>
            <h2 id="timer-history-heading">Today&apos;s timer history</h2>
          </div>
          <span className="timer-history-count">
            <History aria-hidden="true" /> {initialDashboard.completedCount}
          </span>
        </div>

        {initialDashboard.history.length === 0 ? (
          <div className="timer-history-empty">
            <span aria-hidden="true">
              <Clock3 />
            </span>
            <h3>No completed timers today</h3>
            <p>
              Finish a timer today and it will appear here. Earlier days stay
              summarized on Home.
            </p>
          </div>
        ) : (
          <div className="timer-history-list">
            {initialDashboard.history.map((session, index) => {
              const progress =
                longestSessionMs === 0
                  ? 0
                  : Math.max(
                      4,
                      Math.round(
                        (session.accumulatedMs / longestSessionMs) * 100,
                      ),
                    )
              return (
                <article className="timer-history-card" key={session.id}>
                  <div className="timer-history-index">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <div className="timer-history-content">
                    <div className="timer-subject-display">
                      <p>{session.subject}</p>
                    </div>
                    <p className="timer-history-date">
                      <CalendarDays aria-hidden="true" />
                      {formatSessionDate(
                        session.startedAt,
                        initialDashboard.timezone,
                      )}
                    </p>
                    <div className="timer-history-progress" aria-hidden="true">
                      <span style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <strong className="timer-history-duration">
                    {formatCompactDuration(session.accumulatedMs)}
                  </strong>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  tone,
  value,
}: Readonly<{
  icon: LucideIcon
  label: string
  tone: "blue" | "cyan" | "violet"
  value: string
}>) {
  return (
    <article className="timer-metric-card" data-tone={tone}>
      <span aria-hidden="true">
        <Icon />
      </span>
      <strong>{value}</strong>
      <p>{label}</p>
    </article>
  )
}

function SubjectEditor({
  editing,
  editingSubject,
  isPending,
  onCancel,
  onChange,
  onEdit,
  onSave,
  session,
  variant = "default",
}: Readonly<{
  editing: boolean
  editingSubject: string
  isPending: boolean
  onCancel: () => void
  onChange: (value: string) => void
  onEdit: () => void
  onSave: () => void
  session: TimerSessionView
  variant?: "default" | "hero"
}>) {
  if (editing) {
    return (
      <form
        className="timer-subject-editor"
        data-variant={variant}
        onSubmit={(event) => {
          event.preventDefault()
          onSave()
        }}
      >
        <label className="sr-only" htmlFor={`subject-${session.id}`}>
          Edit session subject
        </label>
        <Input
          autoFocus
          disabled={isPending}
          id={`subject-${session.id}`}
          maxLength={160}
          onChange={(event) => onChange(event.target.value)}
          required
          value={editingSubject}
        />
        <Button
          aria-label="Save subject"
          disabled={isPending}
          size="icon-lg"
          type="submit"
        >
          <Check aria-hidden="true" />
        </Button>
        <Button
          aria-label="Cancel subject edit"
          disabled={isPending}
          onClick={onCancel}
          size="icon-lg"
          type="button"
          variant="ghost"
        >
          <X aria-hidden="true" />
        </Button>
      </form>
    )
  }

  return (
    <div className="timer-subject-display" data-variant={variant}>
      <p>{session.subject}</p>
      <Button
        aria-label={`Edit subject ${session.subject}`}
        disabled={isPending}
        onClick={onEdit}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <Pencil aria-hidden="true" />
      </Button>
    </div>
  )
}
