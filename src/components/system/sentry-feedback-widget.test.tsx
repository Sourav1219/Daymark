import * as Sentry from "@sentry/nextjs"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  ReportProblemButton,
  SentryFeedbackWidget,
  openFeedbackModal,
} from "./sentry-feedback-widget"

vi.mock("@sentry/nextjs", () => ({
  captureFeedback: vi.fn().mockResolvedValue("feedback-event"),
}))

describe("SentryFeedbackWidget", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("opens the branded report dialog and sends feedback to Sentry", async () => {
    render(<SentryFeedbackWidget />)

    openFeedbackModal()

    expect(
      await screen.findByRole("dialog", { name: "Report a problem" }),
    ).toBeVisible()

    fireEvent.change(screen.getByLabelText(/Email/), {
      target: { value: "ada@example.com" },
    })
    fireEvent.change(screen.getByLabelText(/What happened/), {
      target: { value: "The quest list did not update." },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send report" }))

    await vi.waitFor(() => {
      expect(Sentry.captureFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "ada@example.com",
          message: "The quest list did not update.",
          source: "user-feedback-widget",
        }),
      )
    })

    expect(
      await screen.findByRole("heading", { name: "Thanks for the heads-up" }),
    ).toBeVisible()
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
