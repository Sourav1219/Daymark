"use client"

import type { CSSProperties } from "react"
import { useEffect } from "react"
import { createPortal } from "react-dom"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, KeyRound, MailCheck, Sparkles } from "lucide-react"

export type AuthSuccessKind = "password-reset" | "reset-link"

const successCopy = {
  "reset-link": {
    action: "Got it",
    eyebrow: "Secure mail sent",
    heading: "Check your inbox",
    message:
      "If this address belongs to an eligible account, your private reset link is on its way.",
  },
  "password-reset": {
    action: "Sign in",
    eyebrow: "Password secured",
    heading: "Fresh start unlocked",
    message:
      "Your new password is active. We’re taking you to sign in securely.",
  },
} as const

const successDurationMilliseconds = 5_000

export function AuthSuccessPopup({
  destination,
  kind,
  onDismiss,
}: Readonly<{
  destination?: Route
  kind: AuthSuccessKind
  onDismiss?: () => void
}>) {
  const router = useRouter()
  const copy = successCopy[kind]
  const Icon = kind === "reset-link" ? MailCheck : KeyRound

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      onDismiss?.()
      if (destination) router.replace(destination)
    }, successDurationMilliseconds)

    return () => window.clearTimeout(timeout)
  }, [destination, onDismiss, router])

  useEffect(() => {
    function completeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      onDismiss?.()
      if (destination) router.replace(destination)
    }

    window.addEventListener("keydown", completeOnEscape)
    return () => window.removeEventListener("keydown", completeOnEscape)
  }, [destination, onDismiss, router])

  function complete() {
    onDismiss?.()
    if (destination) router.replace(destination)
  }

  return createPortal(
    <div className="auth-success__stage" data-kind={kind}>
      <section
        aria-labelledby="auth-success-title"
        aria-live="polite"
        aria-modal="true"
        className="auth-success"
        role="dialog"
      >
        <div aria-hidden="true" className="auth-success__particles">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>

        <div aria-hidden="true" className="auth-success__visual">
          <span className="auth-success__halo" />
          <span className="auth-success__orbit">
            <Sparkles />
          </span>
          <span className="auth-success__icon">
            <Icon />
            <Check />
          </span>
        </div>

        <span className="auth-success__eyebrow">{copy.eyebrow}</span>
        <h2 id="auth-success-title">{copy.heading}</h2>
        <p>{copy.message}</p>

        <button autoFocus onClick={complete} type="button">
          {copy.action}
          {kind === "password-reset" ? (
            <ArrowRight aria-hidden="true" />
          ) : (
            <Check aria-hidden="true" />
          )}
        </button>

        <span
          aria-hidden="true"
          className="auth-success__timer"
          style={
            {
              "--auth-success-duration": `${successDurationMilliseconds}ms`,
            } as CSSProperties
          }
        />
      </section>
    </div>,
    document.body,
  )
}
