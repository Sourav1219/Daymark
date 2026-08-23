"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Check,
  RotateCcw,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react"

import { reopenQuestAction } from "@/features/quests/application/actions"

export type CompletedTaskNotice = Readonly<{
  currentStreak?: number | undefined
  id: string
  streakIncreased?: boolean | undefined
  title: string
  timezone?: string | undefined
  version: number
  xpEarned: number
}>

type NoticePhase = "completed" | "error" | "undone"

export function TaskCompletedPopup({
  onDismiss,
  task,
}: Readonly<{
  onDismiss: () => void
  task: CompletedTaskNotice
}>) {
  const router = useRouter()
  const [phase, setPhase] = useState<NoticePhase>("completed")
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const timeout = window.setTimeout(
      onDismiss,
      phase === "undone" ? 1_800 : 8_000,
    )
    return () => window.clearTimeout(timeout)
  }, [onDismiss, phase, task.id])

  useEffect(() => {
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onDismiss()
    }

    window.addEventListener("keydown", dismissOnEscape)
    return () => window.removeEventListener("keydown", dismissOnEscape)
  }, [onDismiss, pending])

  const undoCompletion = useCallback(() => {
    if (pending || phase === "undone") return

    startTransition(async () => {
      const result = await reopenQuestAction({
        expectedVersion: task.version,
        questId: task.id,
      })

      if (result.ok) {
        setPhase("undone")
        router.refresh()
      } else {
        setPhase("error")
      }
    })
  }, [pending, phase, router, task.id, task.version])

  return createPortal(
    <div className="task-created-popup__stage task-created-popup__stage--completed">
      <div aria-hidden="true" className="task-created-popup__ambient">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <section
        aria-labelledby="task-completed-popup-title"
        aria-live="polite"
        aria-modal="true"
        className="task-created-popup"
        data-kind="completed"
        data-phase={phase}
        role="dialog"
      >
        <div aria-hidden="true" className="task-created-popup__visual">
          <span className="task-created-popup__ring task-created-popup__ring--outer" />
          <span className="task-created-popup__ring task-created-popup__ring--inner" />
          <span className="task-created-popup__icon">
            {phase === "undone" ? <RotateCcw /> : <Trophy />}
            <Sparkles className="task-created-popup__sparkle" />
          </span>
        </div>

        <div className="task-created-popup__copy">
          <span>
            {phase === "undone" ? "Back in action" : "Momentum gained"}
          </span>
          <h2 id="task-completed-popup-title">
            {phase === "undone" ? "Completion undone" : "Task complete!"}
          </h2>
          <p>
            {phase === "undone"
              ? `“${task.title}” is active again and its XP was reversed.`
              : phase === "error"
                ? "Undo did not work. Please try once more."
                : "You finished what you started. Keep that momentum going."}
          </p>
          {phase !== "undone" ? (
            <div className="task-created-popup__summary">
              <strong className="task-created-popup__task">{task.title}</strong>
              <strong className="task-created-popup__reward">
                <Zap aria-hidden="true" />+{task.xpEarned} XP
              </strong>
            </div>
          ) : null}
        </div>

        <div className="task-created-popup__actions">
          {phase !== "undone" ? (
            <button
              autoFocus
              className="task-created-popup__undo"
              disabled={pending}
              onClick={undoCompletion}
              type="button"
            >
              <RotateCcw aria-hidden="true" />
              {pending ? "Undoing…" : "Undo completion"}
            </button>
          ) : null}
          <button
            className="task-created-popup__continue"
            disabled={pending}
            onClick={onDismiss}
            type="button"
          >
            Continue
            {phase === "undone" ? (
              <Check aria-hidden="true" />
            ) : (
              <ArrowRight aria-hidden="true" />
            )}
          </button>
        </div>

        <p className="task-created-popup__hint">
          {phase === "undone"
            ? "Returning to your tasks…"
            : "This screen closes automatically"}
        </p>

        <span aria-hidden="true" className="task-created-popup__timer" />
      </section>
    </div>,
    document.getElementById("app-device-viewport") ?? document.body,
  )
}
