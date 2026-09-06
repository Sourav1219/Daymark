"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Check,
  Flame,
  RotateCcw,
  Sparkles,
  Zap,
} from "lucide-react"
import { toast } from "sonner"

import { reopenQuestAction } from "@/features/quests/application/actions"
import {
  taskCompletionUndoEvent,
  type TaskCompletionUndoEventDetail,
} from "@/features/quests/domain/quest-links"
import type { CompletedTaskNotice } from "@/features/quests/components/task-completed-popup"
import { triggerHaptic } from "@/lib/platform/platform-bridge"

export type StreakCelebrationNotice = Readonly<{
  count: number
  task?: CompletedTaskNotice | undefined
}>

type StreakPhase = "celebrating" | "error" | "undone"

export const streakCelebrationDurationMs = 8_000

function streakCopy(count: number, earned: boolean) {
  if (count <= 0) {
    return {
      eyebrow: "Your next spark",
      heading: "Start the flame",
      message: "Complete one task today and begin building your streak.",
    }
  }

  if (count === 1) {
    return {
      eyebrow: earned ? "Streak ignited" : "Your current streak",
      heading: "1 day strong",
      message: earned
        ? "The first spark is lit. Come back tomorrow and keep it alive."
        : "Your flame is burning. Complete a task today to protect it.",
    }
  }

  return {
    eyebrow: earned ? "New streak reached" : "Your current streak",
    heading: `${count} days strong`,
    message: earned
      ? "You showed up again. That consistency is becoming momentum."
      : "Your momentum is alive. Keep showing up one day at a time.",
  }
}

export function StreakCelebrationPopup({
  notice,
  onDismiss,
}: Readonly<{
  notice: StreakCelebrationNotice
  onDismiss: () => void
}>) {
  const router = useRouter()
  const [phase, setPhase] = useState<StreakPhase>("celebrating")
  const [pending, startTransition] = useTransition()
  const earned = Boolean(notice.task)
  const copy = streakCopy(notice.count, earned)

  const closePopup = useCallback(() => {
    onDismiss()
    if (phase === "undone") router.replace("/today")
  }, [onDismiss, phase, router])

  useEffect(() => {
    router.prefetch("/today")
  }, [router])

  useEffect(() => {
    const timeout = window.setTimeout(closePopup, streakCelebrationDurationMs)
    return () => window.clearTimeout(timeout)
  }, [closePopup, phase])

  useEffect(() => {
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && (!pending || phase === "undone"))
        closePopup()
    }

    window.addEventListener("keydown", dismissOnEscape)
    return () => window.removeEventListener("keydown", dismissOnEscape)
  }, [closePopup, pending, phase])

  const undoCompletion = useCallback(() => {
    const task = notice.task
    if (!task || pending || phase === "undone") return

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
  }, [notice.task, pending, phase, router])

  const heading = phase === "undone" ? "Streak updated" : copy.heading
  const message =
    phase === "undone"
      ? "The completion was undone and your streak has been recalculated."
      : phase === "error"
        ? "Undo did not work. Please try once more."
        : copy.message

  return createPortal(
    <div className="task-created-popup__stage task-created-popup__stage--streak">
      <div
        aria-hidden="true"
        className="task-created-popup__ambient streak-celebration__embers"
      >
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <section
        aria-labelledby="streak-celebration-title"
        aria-live="polite"
        aria-modal="true"
        className="task-created-popup streak-celebration"
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
          <span className="task-created-popup__icon streak-celebration__icon">
            {phase === "undone" ? (
              <RotateCcw />
            ) : (
              <>
                <Flame />
                <strong>{notice.count}</strong>
              </>
            )}
            <Sparkles className="task-created-popup__sparkle" />
          </span>
        </div>

        <div className="task-created-popup__copy" key={`copy-${phase}`}>
          <span>
            {phase === "undone" ? "Flame recalculated" : copy.eyebrow}
          </span>
          <h2 id="streak-celebration-title">{heading}</h2>
          <p>{message}</p>
          {notice.task && phase !== "undone" ? (
            <div className="task-created-popup__summary">
              <strong className="task-created-popup__task">
                {notice.task.title}
              </strong>
              <strong className="task-created-popup__reward">
                <Zap aria-hidden="true" />+{notice.task.xpEarned} XP
              </strong>
            </div>
          ) : null}
        </div>

        <div className="task-created-popup__actions">
          {notice.task && phase !== "undone" ? (
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
            autoFocus={phase === "undone" || !notice.task}
            className="task-created-popup__continue"
            disabled={pending && phase !== "undone"}
            onClick={closePopup}
            type="button"
          >
            {phase === "undone" ? "Continue" : "Keep going"}
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
