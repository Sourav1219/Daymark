"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, RotateCcw, Sparkles } from "lucide-react"

import { softDeleteQuestAction } from "@/features/quests/application/actions"
import { questHomeHref } from "@/features/quests/domain/quest-links"

export type CreatedTaskNotice = Readonly<{
  homeDate?: string | null
  id: string
  title: string
  version: number
}>

type NoticePhase = "created" | "error" | "undone"

export function TaskCreatedPopup({
  onDismiss,
  task,
}: Readonly<{
  onDismiss: () => void
  task: CreatedTaskNotice
}>) {
  const router = useRouter()
  const homeHref = questHomeHref(task.id, task.homeDate)
  const [phase, setPhase] = useState<NoticePhase>("created")
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    router.prefetch(homeHref)
  }, [homeHref, router])

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

  const undoCreation = useCallback(() => {
    if (pending || phase === "undone") return

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
  }, [pending, phase, router, task.id, task.version])

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
          <span>{phase === "undone" ? "All fixed" : "Nice move"}</span>
          <h2 id="task-created-popup-title">
            {phase === "undone" ? "Creation undone" : "Task created!"}
          </h2>
          <p>
            {phase === "undone"
              ? `“${task.title}” was removed.`
              : phase === "error"
                ? "Undo did not work. Please try once more."
                : "Your new task is ready and waiting on Home."}
          </p>
          {phase !== "undone" ? (
            <strong className="task-created-popup__task">{task.title}</strong>
          ) : null}
        </div>

        <div className="task-created-popup__actions">
          {phase !== "undone" ? (
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
          {pending ? (
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
