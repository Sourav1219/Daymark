"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { ArchiveRestore, ArrowRight, Sparkles } from "lucide-react"

export type RestoredTaskNotice = Readonly<{
  id: string
  title: string
}>

export function TaskRestoredPopup({
  onDismiss,
  task,
}: Readonly<{
  onDismiss: () => void
  task: RestoredTaskNotice
}>) {
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
    <div className="task-created-popup__stage task-created-popup__stage--restored">
      <div aria-hidden="true" className="task-created-popup__ambient">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <section
        aria-labelledby="task-restored-popup-title"
        aria-live="polite"
        aria-modal="true"
        className="task-created-popup"
        data-kind="restored"
        role="dialog"
      >
        <div aria-hidden="true" className="task-created-popup__visual">
          <span className="task-created-popup__ring task-created-popup__ring--outer" />
          <span className="task-created-popup__ring task-created-popup__ring--inner" />
          <span className="task-created-popup__icon">
            <ArchiveRestore />
            <Sparkles className="task-created-popup__sparkle" />
          </span>
        </div>

        <div className="task-created-popup__copy">
          <span>Back in motion</span>
          <h2 id="task-restored-popup-title">Task restored!</h2>
          <p>
            Your task is active again with its new timeline. Its earlier
            activity remains in history.
          </p>
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
