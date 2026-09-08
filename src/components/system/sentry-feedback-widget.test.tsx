import * as Sentry from "@sentry/nextjs"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SentryFeedbackWidget } from "./sentry-feedback-widget"

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

  it("creates a privacy-conscious widget with the request CSP nonce", () => {
    const removeFromDom = vi.fn()
    const createWidget = vi.fn(() => ({ removeFromDom }))

    vi.mocked(Sentry.getFeedback)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ createWidget } as never)

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
    expect(Sentry.addIntegration).toHaveBeenCalledOnce()
    expect(createWidget).toHaveBeenCalledOnce()

    view.unmount()
    expect(removeFromDom).toHaveBeenCalledOnce()
  })
})
