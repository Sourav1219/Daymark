"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { Check, KeyRound, Sparkles, UserRound } from "lucide-react"

export type ProfileUpdateKind = "name" | "password"

const updateCopy = {
  name: {
    eyebrow: "Profile refreshed",
    heading: "Looking good!",
    message: "Your new display name is now used across Traketo.",
  },
  password: {
    eyebrow: "Security updated",
    heading: "Password changed",
    message: "Your new password is active and ready for your next sign-in.",
  },
} as const

export function ProfileUpdatePopup({
  kind,
  onDismiss,
}: Readonly<{
  kind: ProfileUpdateKind
  onDismiss: () => void
}>) {
  const copy = updateCopy[kind]
  const Icon = kind === "name" ? UserRound : KeyRound

  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, 5_000)
    return () => window.clearTimeout(timeout)
  }, [onDismiss])

  useEffect(() => {
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss()
    }

    window.addEventListener("keydown", dismissOnEscape)
    return () => window.removeEventListener("keydown", dismissOnEscape)
  }, [onDismiss])

  return createPortal(
    <div className="profile-update-popup__backdrop">
      <section
        aria-labelledby="profile-update-popup-title"
        aria-live="polite"
        aria-modal="true"
        className="profile-update-popup"
        data-kind={kind}
        role="dialog"
      >
        <div aria-hidden="true" className="profile-update-popup__ambient">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div aria-hidden="true" className="profile-update-popup__visual">
          <span className="profile-update-popup__ring" />
          <span className="profile-update-popup__icon">
            <Icon />
            <Sparkles />
          </span>
        </div>
        <span className="profile-update-popup__eyebrow">{copy.eyebrow}</span>
        <h2 id="profile-update-popup-title">{copy.heading}</h2>
        <p>{copy.message}</p>
        <button autoFocus onClick={onDismiss} type="button">
          Done <Check aria-hidden="true" />
        </button>
        <span aria-hidden="true" className="profile-update-popup__timer" />
      </section>
    </div>,
    document.getElementById("app-device-viewport") ?? document.body,
  )
}
