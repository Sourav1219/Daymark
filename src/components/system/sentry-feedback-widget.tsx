"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

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

    const widget = feedback?.createWidget()

    return () => {
      widget?.removeFromDom()
    }
  }, [nonce])

  return null
}
