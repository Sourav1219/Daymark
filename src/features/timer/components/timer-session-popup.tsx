"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { ArrowRight, Check, Pause, Play, Sparkles } from "lucide-react"

export type TimerSessionCelebration = Readonly<{
  durationMs?: number
  kind: "finished" | "paused" | "started"
  subject: string
}>

const celebrationDurationMs = 6_000

function formatCelebrationDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000))
  const hours = Math.floor(totalSeconds / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}h ${minutes}m focused`
  if (minutes > 0) return `${minutes}m ${seconds}s focused`
  return `${seconds}s focused`
}

export function TimerSessionPopup({
  celebration,
  onDismiss,
}: Readonly<{
  celebration: TimerSessionCelebration
  onDismiss: () => void
}>) {
  const finished = celebration.kind === "finished"
  const paused = celebration.kind === "paused"

  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, celebrationDurationMs)
    return () => window.clearTimeout(timeout)
  }, [celebration.kind, celebration.subject, onDismiss])

  useEffect(() => {
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss()
    }

    window.addEventListener("keydown", dismissOnEscape)
    return () => window.removeEventListener("keydown", dismissOnEscape)
  }, [onDismiss])

  const titleId = `timer-session-popup-title-${celebration.kind}`

  return createPortal(
    <div
      className={`task-created-popup__stage timer-session-popup__stage timer-session-popup__stage--${celebration.kind}`}
    >
      <div aria-hidden="true" className="task-created-popup__ambient">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <section
        aria-labelledby={titleId}
        aria-live="polite"
        aria-modal="true"
        className="task-created-popup timer-session-popup"
        data-timer-kind={celebration.kind}
        role="dialog"
      >
        <div aria-hidden="true" className="task-created-popup__visual">
          <span className="task-created-popup__ring task-created-popup__ring--outer" />
          <span className="task-created-popup__ring task-created-popup__ring--inner" />
          <span className="task-created-popup__icon">
            {finished ? <Check /> : paused ? <Pause /> : <Play />}
            <Sparkles className="task-created-popup__sparkle" />
          </span>
        </div>

        <div className="task-created-popup__copy">
          <span>
            {finished
              ? "Focus captured"
              : paused
                ? "Focus held"
                : "Focus mode on"}
          </span>
          <h2 id={titleId}>
            {finished
              ? "Session complete!"
              : paused
                ? "Timer paused!"
                : "Timer started!"}
          </h2>
          <p>
            {finished
              ? "Your focused time is saved safely in Timer history."
              : paused
                ? "Your place is saved. Resume whenever you’re ready."
                : "You’re all set. Stay with this one thing."}
          </p>
          <strong className="task-created-popup__task">
            {celebration.subject}
          </strong>
          {finished && celebration.durationMs !== undefined ? (
            <span className="timer-session-popup__duration">
              {formatCelebrationDuration(celebration.durationMs)}
            </span>
          ) : null}
        </div>

        <div className="task-created-popup__actions timer-session-popup__actions">
          <button
            autoFocus
            className="task-created-popup__continue"
            onClick={onDismiss}
            type="button"
          >
            Continue
            <ArrowRight aria-hidden="true" />
          </button>
        </div>

        <p className="task-created-popup__hint">
          This screen closes automatically
        </p>
        <span aria-hidden="true" className="task-created-popup__timer" />
      </section>
    </div>,
    document.getElementById("app-device-viewport") ?? document.body,
  )
}
