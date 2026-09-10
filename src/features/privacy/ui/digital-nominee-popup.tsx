"use client"

import { useEffect, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { ArrowRight, Sparkles, Trash2, UserCheck } from "lucide-react"

export type NomineeNotice = Readonly<{
  action: "added" | "removed"
  name: string
  relationship?: string
}>

function subscribeStatic() {
  return () => undefined
}

function getClientMounted() {
  return true
}

function getServerMounted() {
  return false
}

export function DigitalNomineePopup({
  notice,
  onDismiss,
}: Readonly<{
  notice: NomineeNotice
  onDismiss: () => void
}>) {
  const mounted = useSyncExternalStore(
    subscribeStatic,
    getClientMounted,
    getServerMounted,
  )
  const isAdded = notice.action === "added"

  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, 7_000)
    return () => window.clearTimeout(timeout)
  }, [onDismiss, notice])

  useEffect(() => {
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss()
    }

    window.addEventListener("keydown", dismissOnEscape)
    return () => window.removeEventListener("keydown", dismissOnEscape)
  }, [onDismiss])

  if (!mounted || typeof document === "undefined") return null

  const portalTarget =
    document.getElementById("app-device-viewport") ?? document.body

  return createPortal(
    <div
      className={`task-created-popup__stage ${
        isAdded
          ? "task-created-popup__stage--nominee-added"
          : "task-created-popup__stage--deleted"
      }`}
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
        aria-labelledby="nominee-popup-title"
        aria-live="polite"
        aria-modal="true"
        className="task-created-popup"
        data-kind={isAdded ? "nominee-added" : "deleted"}
        role="dialog"
      >
        <div aria-hidden="true" className="task-created-popup__visual">
          <span className="task-created-popup__ring task-created-popup__ring--outer" />
          <span className="task-created-popup__ring task-created-popup__ring--inner" />
          <span className="task-created-popup__icon">
            {isAdded ? <UserCheck /> : <Trash2 />}
            <Sparkles className="task-created-popup__sparkle" />
          </span>
        </div>

        <div className="task-created-popup__copy">
          <span>
            {isAdded ? "DPDP Act 2023 · Sec. 14" : "Nomination Revoked"}
          </span>
          <h2 id="nominee-popup-title">
            {isAdded ? "Nominee Appointed!" : "Nominee Removed"}
          </h2>
          <p>
            {isAdded
              ? "Your digital nominee has been registered. In the event of incapacity, your designated representative has legal standing to exercise your statutory data rights."
              : "Digital nominee delegation has been revoked from your account. You can appoint a new trusted representative at any time."}
          </p>
          <strong className="task-created-popup__task">
            {isAdded
              ? `🛡️ ${notice.name}${notice.relationship ? ` · ${notice.relationship}` : ""}`
              : `🔒 Delegation Revoked for ${notice.name}`}
          </strong>
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
    portalTarget,
  )
}
