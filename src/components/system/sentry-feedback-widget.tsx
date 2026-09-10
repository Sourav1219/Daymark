"use client"

import * as Sentry from "@sentry/nextjs"
import {
  CircleCheck,
  LoaderCircle,
  MessageSquareWarning,
  Send,
  ShieldCheck,
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

const ISSUE_CATEGORIES = [
  { emoji: "🐛", id: "bug", label: "Bug / Glitch" },
  { emoji: "🎨", id: "ui", label: "Visual / UI" },
  { emoji: "⚡", id: "speed", label: "Slow / Lag" },
  { emoji: "💡", id: "idea", label: "Suggestion" },
  { emoji: "💬", id: "other", label: "Other" },
] as const

export function SentryFeedbackWidget() {
  const [open, setOpen] = useState(false)
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  )
  const [status, setStatus] = useState<FeedbackStatus>("idle")
  const [category, setCategory] = useState<string>("bug")
  const [messageLength, setMessageLength] = useState(0)

  useEffect(() => {
    const handleOpen = () => {
      setPortalContainer(document.getElementById("app-device-viewport"))
      setStatus("idle")
      setMessageLength(0)
      setCategory("bug")
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
    if (!nextOpen) {
      setStatus("idle")
      setMessageLength(0)
    }
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
        tags: { category, source: "user-feedback-widget" },
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
              Your report was sent to our team. We’ll investigate and use it to
              keep Traketo running smoothly.
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
                <small>
                  <span className="feedback-dialog__pulse-dot" />
                  Support &amp; Feedback
                </small>
                <DialogTitle>Report a problem</DialogTitle>
                <DialogDescription id="feedback-dialog-description">
                  Tell us what went wrong so we can investigate and resolve it.
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
              {/* Category selector */}
              <div className="feedback-dialog__field">
                <span className="feedback-dialog__category-label">
                  Issue type
                </span>
                <div
                  aria-label="Issue category"
                  className="feedback-dialog__categories"
                  role="group"
                >
                  {ISSUE_CATEGORIES.map((cat) => {
                    const isSelected = category === cat.id
                    return (
                      <button
                        aria-pressed={isSelected}
                        className={`feedback-category-chip ${
                          isSelected ? "feedback-category-chip--active" : ""
                        }`}
                        key={cat.id}
                        onClick={() => setCategory(cat.id)}
                        type="button"
                      >
                        <span aria-hidden="true">{cat.emoji}</span>
                        <span>{cat.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

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
                  onChange={(e) => setMessageLength(e.target.value.length)}
                  placeholder="Tell us what went wrong and what you expected to happen."
                  required
                  rows={4}
                />
              </label>

              <div className="feedback-dialog__meta-row">
                <span className="feedback-dialog__tip">
                  💡 Steps to reproduce help us resolve bugs faster
                </span>
                {messageLength > 0 && (
                  <span className="feedback-dialog__counter">
                    {messageLength} chars
                  </span>
                )}
              </div>

              <div className="feedback-dialog__context-note">
                <ShieldCheck aria-hidden="true" />
                <span>
                  Current page URL &amp; platform diagnostics are automatically
                  attached
                </span>
              </div>

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
