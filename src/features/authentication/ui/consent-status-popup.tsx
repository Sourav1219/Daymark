"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { Bell, Check, HardDrive, Mail, Minus } from "lucide-react"

export type ConsentStatusKind = "email" | "offline" | "push"

const popupCopy = {
  email: "Email reminders",
  offline: "Device storage",
  push: "Web push",
} as const

const popupDurationMs = 2_400

export function ConsentStatusPopup({
  enabled,
  kind,
  onDismiss,
}: Readonly<{
  enabled: boolean
  kind: ConsentStatusKind
  onDismiss: () => void
}>) {
  const ItemIcon = kind === "email" ? Mail : kind === "push" ? Bell : HardDrive
  const StatusIcon = enabled ? Check : Minus
  const status = enabled ? "Enabled" : "Withdrawn"

  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, popupDurationMs)
    return () => window.clearTimeout(timeout)
  }, [onDismiss])

  return createPortal(
    <div aria-live="polite" className="consent-status-popup__layer">
      <section
        aria-label={`${popupCopy[kind]} ${status}`}
        className="consent-status-popup"
        data-kind={kind}
        data-status={enabled ? "enabled" : "withdrawn"}
        role="status"
      >
        <span aria-hidden="true" className="consent-status-popup__halo" />
        <span aria-hidden="true" className="consent-status-popup__icon">
          <ItemIcon />
          <span>
            <StatusIcon />
          </span>
        </span>
        <span className="consent-status-popup__label">{popupCopy[kind]}</span>
        <strong>{status}</strong>
        <span aria-hidden="true" className="consent-status-popup__timer" />
      </section>
    </div>,
    document.getElementById("app-device-viewport") ?? document.body,
  )
}
