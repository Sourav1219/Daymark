"use client"

import * as Sentry from "@sentry/nextjs"
import { type ComponentProps, useEffect } from "react"

export const OPEN_FEEDBACK_EVENT = "traketo:open-feedback"

export function openFeedbackModal() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_FEEDBACK_EVENT))
  }
}

type SentryFeedbackWidgetProps = Readonly<{
  nonce?: string | undefined
}>

export function SentryFeedbackWidget({ nonce }: SentryFeedbackWidgetProps) {
  useEffect(() => {
    let feedback = Sentry.getFeedback()

    if (!feedback) {
      Sentry.addIntegration(
        Sentry.feedbackIntegration({
          autoInject: false,
          colorScheme: "system",
          enableScreenshot: false,
          formTitle: "Report a problem",
          isEmailRequired: false,
          messageLabel: "What happened?",
          messagePlaceholder:
            "Tell us what went wrong and what you expected to happen.",
          scriptNonce: nonce,
          showEmail: true,
          showName: false,
          styleNonce: nonce,
          submitButtonLabel: "Send report",
          successMessageText: "Thank you. Your report was sent.",
          tags: { source: "user-feedback-widget" },
          triggerAriaLabel: "Report a problem",
          triggerLabel: "Report a problem",
        }),
      )
      feedback = Sentry.getFeedback()
    }

    let dialog: {
      appendToDom: () => void
      open: () => void
      close?: () => void
      removeFromDom: () => void
    } | null = null

    const handleOpen = async () => {
      const activeFeedback = Sentry.getFeedback()
      if (!activeFeedback) return

      try {
        if (!dialog) {
          dialog = await activeFeedback.createForm({
            onFormClose: () => {
              dialog?.removeFromDom()
              dialog = null
            },
            onFormSubmitted: () => {
              dialog?.removeFromDom()
              dialog = null
            },
          })
        }
        dialog.appendToDom()
        dialog.open()
      } catch (err) {
        console.error("Failed to open Sentry feedback form:", err)
      }
    }

    window.addEventListener(OPEN_FEEDBACK_EVENT, handleOpen)

    return () => {
      window.removeEventListener(OPEN_FEEDBACK_EVENT, handleOpen)
      dialog?.removeFromDom()
    }
  }, [nonce])

  return null
}

export function ReportProblemButton({
  children,
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      onClick={(e) => {
        props.onClick?.(e)
        if (!e.defaultPrevented) {
          openFeedbackModal()
        }
      }}
    >
      {children ?? "Report a problem"}
    </button>
  )
}
