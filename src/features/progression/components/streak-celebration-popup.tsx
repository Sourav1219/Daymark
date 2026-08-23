"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { ArrowRight, Flame, RotateCcw, Sparkles, Zap } from "lucide-react"

import { reopenQuestAction } from "@/features/quests/application/actions"
import type { CompletedTaskNotice } from "@/features/quests/components/task-completed-popup"

export type StreakCelebrationNotice = Readonly<{
  count: number
  task?: CompletedTaskNotice | undefined
}>

type StreakPhase = "celebrating" | "error" | "undone"

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

  useEffect(() => {
    const timeout = window.setTimeout(
      onDismiss,
      phase === "undone" ? 1_800 : 8_000,
    )
    return () => window.clearTimeout(timeout)
  }, [onDismiss, phase])

  useEffect(() => {
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onDismiss()
    }

    window.addEventListener("keydown", dismissOnEscape)
    return () => window.removeEventListener("keydown", dismissOnEscape)
  }, [onDismiss, pending])

  const undoCompletion = useCallback(() => {
    const task = notice.task
    if (!task || pending || phase === "undone") return

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
        <div aria-hidden="true" className="task-created-popup__visual">
          <span className="task-created-popup__ring task-created-popup__ring--outer" />
          <span className="task-created-popup__ring task-created-popup__ring--inner" />
          <span className="task-created-popup__icon streak-celebration__icon">
            <Flame />
            <strong>{notice.count}</strong>
            <Sparkles className="task-created-popup__sparkle" />
          </span>
        </div>

        <div className="task-created-popup__copy">
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
            autoFocus={!notice.task}
            className="task-created-popup__continue"
            disabled={pending}
            onClick={onDismiss}
            type="button"
          >
            Keep going
            <ArrowRight aria-hidden="true" />
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
