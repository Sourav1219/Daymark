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
import { toast } from "sonner"

import { reopenQuestAction } from "@/features/quests/application/actions"
import {
  taskCompletionUndoEvent,
  type TaskCompletionUndoEventDetail,
} from "@/features/quests/domain/quest-links"
import { triggerHaptic } from "@/lib/platform/platform-bridge"

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
export const taskCompletedResultDurationMs = 8_000

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

  const closePopup = useCallback(() => {
    onDismiss()
    if (phase === "undone") router.replace("/today")
  }, [onDismiss, phase, router])

  useEffect(() => {
    router.prefetch("/today")
  }, [router])

  useEffect(() => {
    const timeout = window.setTimeout(closePopup, taskCompletedResultDurationMs)
    return () => window.clearTimeout(timeout)
  }, [closePopup, task.id])

  useEffect(() => {
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && (!pending || phase === "undone")) {
        closePopup()
      }
    }

    window.addEventListener("keydown", dismissOnEscape)
    return () => window.removeEventListener("keydown", dismissOnEscape)
  }, [closePopup, pending, phase])

  const undoCompletion = useCallback(() => {
    if (pending || phase === "undone") return

    function announceUndo(detail: TaskCompletionUndoEventDetail) {
      window.dispatchEvent(
        new CustomEvent<TaskCompletionUndoEventDetail>(
          taskCompletionUndoEvent,
          { detail },
        ),
      )
    }

    triggerHaptic("selection")
    setPhase("undone")
    announceUndo({ phase: "started", questId: task.id })

    startTransition(async () => {
      try {
        const result = await reopenQuestAction({
          expectedVersion: task.version,
          questId: task.id,
        })

        if (result.ok) {
          announceUndo({
            phase: "confirmed",
            questId: task.id,
            version: result.data.version,
          })
          router.refresh()
          return
        }

        announceUndo({ phase: "failed", questId: task.id })
        setPhase("error")
        toast.error(result.error.message)
      } catch {
        announceUndo({ phase: "failed", questId: task.id })
        setPhase("error")
        toast.error("The completion could not be undone. Please try again.")
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
        <div
          aria-hidden="true"
          className="task-created-popup__visual"
          key={`visual-${phase}`}
        >
          <span className="task-created-popup__ring task-created-popup__ring--outer" />
          <span className="task-created-popup__ring task-created-popup__ring--inner" />
          <span className="task-created-popup__icon">
            {phase === "undone" ? <RotateCcw /> : <Trophy />}
            <Sparkles className="task-created-popup__sparkle" />
          </span>
        </div>

        <div className="task-created-popup__copy" key={`copy-${phase}`}>
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
            disabled={pending && phase !== "undone"}
            onClick={closePopup}
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

        <span
          aria-hidden="true"
          className="task-created-popup__timer"
          key={`timer-${phase}`}
        />
      </section>
    </div>,
    document.getElementById("app-device-viewport") ?? document.body,
  )
}
