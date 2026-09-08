"use client"

import * as Sentry from "@sentry/nextjs"
import {
  CircleCheck,
  LoaderCircle,
  MessageSquareWarning,
  Send,
  X,
} from "lucide-react"
import { type ComponentProps, type FormEvent, useEffect, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"

export const OPEN_FEEDBACK_EVENT = "traketo:open-feedback"

export function openFeedbackModal() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_FEEDBACK_EVENT))
  }
}

type FeedbackStatus = "idle" | "sending" | "sent" | "error"

export function SentryFeedbackWidget() {
  const [open, setOpen] = useState(false)
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  )
  const [status, setStatus] = useState<FeedbackStatus>("idle")

  useEffect(() => {
    const handleOpen = () => {
      setPortalContainer(document.getElementById("app-device-viewport"))
      setStatus("idle")
      setOpen(true)
    }

    window.addEventListener(OPEN_FEEDBACK_EVENT, handleOpen)

    return () => {
      window.removeEventListener(OPEN_FEEDBACK_EVENT, handleOpen)
    }
  }, [])

  const handleOpenChange = (nextOpen: boolean) => {
    if (status === "sending") return
    setOpen(nextOpen)
    if (!nextOpen) setStatus("idle")
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const email = String(formData.get("email") ?? "").trim()
    const message = String(formData.get("message") ?? "").trim()

    if (!message) return

    setStatus("sending")
    try {
      await Sentry.captureFeedback({
        message,
        ...(email ? { email } : {}),
        source: "user-feedback-widget",
        tags: { source: "user-feedback-widget" },
        url: window.location.href,
      })
      form.reset()
      setStatus("sent")
    } catch (error) {
      console.error("Failed to send Sentry feedback:", error)
      setStatus("error")
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent
        aria-describedby="feedback-dialog-description"
        className="feedback-dialog"
        onEscapeKeyDown={(event) => {
          if (status === "sending") event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (status === "sending") event.preventDefault()
        }}
        overlayClassName="feedback-dialog__overlay"
        portalContainer={portalContainer}
      >
        <span aria-hidden="true" className="feedback-dialog__orb" />
        {status === "sent" ? (
          <div className="feedback-dialog__success">
            <span>
              <CircleCheck aria-hidden="true" />
            </span>
            <small>Report received</small>
            <DialogTitle>Thanks for the heads-up</DialogTitle>
            <DialogDescription id="feedback-dialog-description">
              Your report was sent to the developers. We’ll use it to make
              Traketo better.
            </DialogDescription>
            <button onClick={() => handleOpenChange(false)} type="button">
              Done
            </button>
          </div>
        ) : (
          <>
            <header className="feedback-dialog__header">
              <span className="feedback-dialog__icon">
                <MessageSquareWarning aria-hidden="true" />
              </span>
              <div>
                <small>Support &amp; feedback</small>
                <DialogTitle>Report a problem</DialogTitle>
                <DialogDescription id="feedback-dialog-description">
                  Tell us what went wrong so we can look into it.
                </DialogDescription>
              </div>
              <button
                aria-label="Close report form"
                className="feedback-dialog__close"
                disabled={status === "sending"}
                onClick={() => handleOpenChange(false)}
                type="button"
              >
                <X aria-hidden="true" />
              </button>
            </header>

            <form className="feedback-dialog__form" onSubmit={handleSubmit}>
              <label className="feedback-dialog__field">
                <span>
                  Email <small>Optional</small>
                </span>
                <input
                  autoComplete="email"
                  inputMode="email"
                  name="email"
                  placeholder="you@example.com"
                  type="email"
                />
              </label>

              <label className="feedback-dialog__field">
                <span>
                  What happened? <b>Required</b>
                </span>
                <textarea
                  autoFocus
                  name="message"
                  placeholder="Tell us what went wrong and what you expected to happen."
                  required
                  rows={5}
                />
              </label>

              {status === "error" ? (
                <p className="feedback-dialog__error" role="alert">
                  We couldn’t send the report. Please try again.
                </p>
              ) : null}

              <div className="feedback-dialog__actions">
                <button
                  className="feedback-dialog__cancel"
                  disabled={status === "sending"}
                  onClick={() => handleOpenChange(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="feedback-dialog__submit"
                  disabled={status === "sending"}
                  type="submit"
                >
                  {status === "sending" ? (
                    <LoaderCircle aria-hidden="true" />
                  ) : (
                    <Send aria-hidden="true" />
                  )}
                  {status === "sending" ? "Sending…" : "Send report"}
                </button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
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
