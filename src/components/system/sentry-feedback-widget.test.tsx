import * as Sentry from "@sentry/nextjs"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  ReportProblemButton,
  SentryFeedbackWidget,
  openFeedbackModal,
} from "./sentry-feedback-widget"

vi.mock("@sentry/nextjs", () => ({
  addIntegration: vi.fn(),
  feedbackIntegration: vi.fn(() => ({ name: "Feedback" })),
  getFeedback: vi.fn(),
}))

describe("SentryFeedbackWidget", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("configures feedback with CSP nonces and opens the dialog upon trigger", async () => {
    const appendToDom = vi.fn()
    const open = vi.fn()
    const removeFromDom = vi.fn()
    const createForm = vi.fn().mockResolvedValue({
      appendToDom,
      open,
      removeFromDom,
    })

    vi.mocked(Sentry.getFeedback)
      .mockReturnValueOnce(undefined)
      .mockReturnValue({ createForm } as never)

    const view = render(<SentryFeedbackWidget nonce="request-nonce" />)

    expect(Sentry.feedbackIntegration).toHaveBeenCalledWith(
      expect.objectContaining({
        autoInject: false,
        enableScreenshot: false,
        scriptNonce: "request-nonce",
        showName: false,
        styleNonce: "request-nonce",
        triggerLabel: "Report a problem",
      }),
    )

    openFeedbackModal()

    await vi.waitFor(() => {
      expect(createForm).toHaveBeenCalledOnce()
      expect(appendToDom).toHaveBeenCalledOnce()
      expect(open).toHaveBeenCalledOnce()
    })

    view.unmount()
    expect(removeFromDom).toHaveBeenCalledOnce()
  })

  it("ReportProblemButton dispatches open feedback trigger", () => {
    const listener = vi.fn()
    window.addEventListener("traketo:open-feedback", listener)

    render(<ReportProblemButton>Need help?</ReportProblemButton>)
    fireEvent.click(screen.getByRole("button", { name: "Need help?" }))

    expect(listener).toHaveBeenCalledOnce()
    window.removeEventListener("traketo:open-feedback", listener)
  })
})
