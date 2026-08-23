"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { ArrowRight, Sparkles, Trash2 } from "lucide-react"

export type DeletedTaskNotice = Readonly<{
  id: string
  kind: "cancelled" | "missed" | "permanent"
  title: string
}>

function deletionCopy(kind: DeletedTaskNotice["kind"]) {
  if (kind === "permanent") {
    return {
      description:
        "The task has been permanently removed from Trash and can no longer be restored.",
      eyebrow: "Clean slate",
      title: "Task deleted",
    }
  }

  if (kind === "missed") {
    return {
      description:
        "The missed-task penalty stays in Progress. You can restore this task until midnight after choosing a new timeline.",
      eyebrow: "Miss acknowledged",
      title: "Moved to Trash",
    }
  }

  return {
    description:
      "No points were deducted, and its value was removed from your planned total. You can restore it until midnight.",
    eyebrow: "Schedule updated",
    title: "Moved to Trash",
  }
}

export function TaskDeletedPopup({
  onDismiss,
  task,
}: Readonly<{
  onDismiss: () => void
  task: DeletedTaskNotice
}>) {
  const copy = deletionCopy(task.kind)

  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, 8_000)
    return () => window.clearTimeout(timeout)
  }, [onDismiss, task.id])

  useEffect(() => {
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss()
    }

    window.addEventListener("keydown", dismissOnEscape)
    return () => window.removeEventListener("keydown", dismissOnEscape)
  }, [onDismiss])

  return createPortal(
    <div className="task-created-popup__stage task-created-popup__stage--deleted">
      <div aria-hidden="true" className="task-created-popup__ambient">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <section
        aria-labelledby="task-deleted-popup-title"
        aria-live="polite"
        aria-modal="true"
        className="task-created-popup"
        data-kind="deleted"
        role="dialog"
      >
        <div aria-hidden="true" className="task-created-popup__visual">
          <span className="task-created-popup__ring task-created-popup__ring--outer" />
          <span className="task-created-popup__ring task-created-popup__ring--inner" />
          <span className="task-created-popup__icon">
            <Trash2 />
            <Sparkles className="task-created-popup__sparkle" />
          </span>
        </div>

        <div className="task-created-popup__copy">
          <span>{copy.eyebrow}</span>
          <h2 id="task-deleted-popup-title">{copy.title}</h2>
          <p>{copy.description}</p>
          <strong className="task-created-popup__task">{task.title}</strong>
        </div>

        <div className="task-created-popup__actions">
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
