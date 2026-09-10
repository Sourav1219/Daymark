"use client"

import { useEffect, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { ArrowRight, Eye, EyeOff, Sparkles } from "lucide-react"
import "@/app/styles/quest-studio.css"

export type GroupStudyPrivacyNotice = Readonly<{
  enabled: boolean
}>

const privacyNoticeDurationMs = 2_800

function subscribeStatic() {
  return () => undefined
}

function getClientMounted() {
  return true
}

function getServerMounted() {
  return false
}

export function GroupStudyPrivacyPopup({
  notice,
  onDismiss,
}: Readonly<{
  notice: GroupStudyPrivacyNotice
  onDismiss: () => void
}>) {
  const mounted = useSyncExternalStore(
    subscribeStatic,
    getClientMounted,
    getServerMounted,
  )
  const isEnabled = notice.enabled

  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, privacyNoticeDurationMs)
    return () => window.clearTimeout(timeout)
  }, [notice.enabled, onDismiss])

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

  const titleId = isEnabled
    ? "group-study-privacy-popup-enabled"
    : "group-study-privacy-popup-disabled"

  return createPortal(
    <div
      className={`task-created-popup__stage group-study-privacy-popup__stage ${
        isEnabled
          ? "group-study-privacy-popup__stage--enabled"
          : "group-study-privacy-popup__stage--disabled"
      }`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss()
      }}
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
        className="task-created-popup group-study-privacy-popup"
        data-privacy-kind={isEnabled ? "enabled" : "disabled"}
        role="dialog"
      >
        <div aria-hidden="true" className="task-created-popup__visual">
          <span className="task-created-popup__ring task-created-popup__ring--outer" />
          <span className="task-created-popup__ring task-created-popup__ring--inner" />
          <span className="task-created-popup__icon">
            {isEnabled ? <EyeOff /> : <Eye />}
            <Sparkles className="task-created-popup__sparkle" />
          </span>
        </div>

        <div className="task-created-popup__copy">
          <span>
            {isEnabled ? "Privacy Mode · Masked" : "Privacy Mode · Revealed"}
          </span>
          <h2 id={titleId}>
            {isEnabled ? "Privacy mode on!" : "Subjects visible!"}
          </h2>
          <p>
            {isEnabled
              ? "All room and participant subjects are now masked as “Focusing”."
              : "Room and participant study subjects are now visible."}
          </p>
          <strong className="task-created-popup__task">
            {isEnabled ? "🔒 Showing “Focusing”" : "👁️ Study subjects visible"}
          </strong>
        </div>

        <div className="task-created-popup__actions">
          <button
            autoFocus
            className="task-created-popup__continue"
            onClick={onDismiss}
            type="button"
          >
            Got it
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
