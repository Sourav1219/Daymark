"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, RotateCcw, Sparkles } from "lucide-react"

import { softDeleteQuestAction } from "@/features/quests/application/actions"
import { questHomeHref } from "@/features/quests/domain/quest-links"

export type CreatedTaskNotice = Readonly<{
  id: string
  title: string
  version: number
}>

type NoticePhase = "created" | "error" | "undone"

export function TaskCreatedPopup({
  onDismiss,
  task,
  variant = "created",
}: Readonly<{
  onDismiss: () => void
  task: CreatedTaskNotice
  variant?: "created" | "updated"
}>) {
  const router = useRouter()
  const homeHref = questHomeHref(task.id)
  const [phase, setPhase] = useState<NoticePhase>("created")
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (variant === "created") {
      router.prefetch(homeHref)
    }
  }, [homeHref, router, variant])

  useEffect(() => {
    const timeout = window.setTimeout(
      onDismiss,
      phase === "undone" ? 1_800 : variant === "updated" ? 4_000 : 8_000,
    )
    return () => window.clearTimeout(timeout)
  }, [onDismiss, phase, task.id, variant])

  useEffect(() => {
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onDismiss()
    }

    window.addEventListener("keydown", dismissOnEscape)
    return () => window.removeEventListener("keydown", dismissOnEscape)
  }, [onDismiss, pending])

  const undoCreation = useCallback(() => {
    if (pending || phase === "undone" || variant === "updated") return

    startTransition(async () => {
      const result = await softDeleteQuestAction({
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
  }, [pending, phase, router, task.id, task.version, variant])

  const isUpdated = variant === "updated"

  return createPortal(
    <div className="task-created-popup__stage">
      <div aria-hidden="true" className="task-created-popup__ambient">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <section
        aria-labelledby="task-created-popup-title"
        aria-live="polite"
        aria-modal="true"
        className="task-created-popup"
        data-phase={phase}
        role="dialog"
      >
        <div aria-hidden="true" className="task-created-popup__visual">
          <span className="task-created-popup__ring task-created-popup__ring--outer" />
          <span className="task-created-popup__ring task-created-popup__ring--inner" />
          <span className="task-created-popup__icon">
            {phase === "undone" ? <RotateCcw /> : <Check />}
            <Sparkles className="task-created-popup__sparkle" />
          </span>
        </div>

        <div className="task-created-popup__copy">
          <span>
            {phase === "undone"
              ? "All fixed"
              : isUpdated
                ? "All set"
                : "Nice move"}
          </span>
          <h2 id="task-created-popup-title">
            {phase === "undone"
              ? "Creation undone"
              : isUpdated
                ? "Task updated!"
                : "Task created!"}
          </h2>
          <p>
            {phase === "undone"
              ? `“${task.title}” was removed.`
              : phase === "error"
                ? "Undo did not work. Please try once more."
                : isUpdated
                  ? "Your changes are saved and updated on Home."
                  : "Your new task is ready and waiting on Home."}
          </p>
          {phase !== "undone" ? (
            <strong className="task-created-popup__task">{task.title}</strong>
          ) : null}
        </div>

        <div className="task-created-popup__actions">
          {phase !== "undone" && !isUpdated ? (
            <button
              autoFocus
              className="task-created-popup__undo"
              disabled={pending}
              onClick={undoCreation}
              type="button"
            >
              <RotateCcw aria-hidden="true" />
              {pending ? "Undoing…" : "Undo creation"}
            </button>
          ) : null}
          {isUpdated ? (
            <button
              autoFocus
              className="task-created-popup__continue"
              onClick={onDismiss}
              type="button"
            >
              Continue
              <ArrowRight aria-hidden="true" />
            </button>
          ) : pending ? (
            <button
              className="task-created-popup__continue"
              disabled
              type="button"
            >
              Continue
              <ArrowRight aria-hidden="true" />
            </button>
          ) : (
            <Link className="task-created-popup__continue" href={homeHref}>
              Continue
              <ArrowRight aria-hidden="true" />
            </Link>
          )}
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

export function TaskUpdatedPopup({
  onDismiss,
  task,
}: Readonly<{
  onDismiss: () => void
  task: CreatedTaskNotice
}>) {
  return (
    <TaskCreatedPopup
      onDismiss={onDismiss}
      task={task}
      variant="updated"
    />
  )
}
