import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EmailVerificationPanel } from "./email-verification-panel"

const actions = vi.hoisted(() => ({
  resendVerificationAction: vi.fn(),
  verifyEmailCodeAction: vi.fn(),
}))

vi.mock("@/features/authentication/application/actions", () => actions)

describe("EmailVerificationPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("counts down the ten-minute code lifetime", () => {
    vi.useFakeTimers()
    render(<EmailVerificationPanel email="person@example.test" />)

    expect(screen.getByText(/10:00 remaining/u)).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1_000)
    })

    expect(screen.getByText(/9:59 remaining/u)).toBeInTheDocument()
  })

  it("decreases resends and replaces the generic success panel", async () => {
    actions.resendVerificationAction.mockImplementation(async () => ({
      data: {
        email: "person@example.test",
        message: "Generic provider-safe response",
        verificationRequired: true,
      },
      ok: true as const,
    }))
    const user = userEvent.setup()
    render(<EmailVerificationPanel email="person@example.test" />)

    await user.click(screen.getByRole("button", { name: "Resend code" }))

    await waitFor(() => {
      expect(screen.getByText(/4 resends left/u)).toBeInTheDocument()
    })
    expect(
      screen.getByText("New code requested. Check your inbox."),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Generic provider-safe response"),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Resend code" }))

    await waitFor(() => {
      expect(screen.getByText(/3 resends left/u)).toBeInTheDocument()
    })
  })

  it("returns an embedded verification view to the sign-in form", async () => {
    const onBackToSignIn = vi.fn()
    const user = userEvent.setup()
    render(
      <EmailVerificationPanel
        email="person@example.test"
        onBackToSignIn={onBackToSignIn}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Back to sign in" }))

    expect(onBackToSignIn).toHaveBeenCalledOnce()
  })
})
