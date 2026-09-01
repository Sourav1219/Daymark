import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { AccountEmailForm } from "./account-email-form"

const actions = vi.hoisted(() => ({
  requestPasswordResetAction: vi.fn(),
  resendVerificationAction: vi.fn(),
}))

vi.mock("@/features/authentication/application/actions", () => actions)
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}))

describe("AccountEmailForm password recovery", () => {
  it("replaces the inline success banner with the timed inbox popup", async () => {
    actions.requestPasswordResetAction.mockResolvedValue({
      data: {
        message:
          "If an eligible account exists, a password-reset link has been sent.",
      },
      ok: true,
    })
    const user = userEvent.setup()

    render(<AccountEmailForm mode="password-reset" />)

    await user.type(
      screen.getByRole("textbox", { name: "Email" }),
      "person@example.test",
    )
    await user.click(screen.getByRole("button", { name: "Send reset link" }))

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "Check your inbox" }),
      ).toBeVisible()
    })
    expect(
      screen.queryByText(
        "If an eligible account exists, a password-reset link has been sent.",
      ),
    ).not.toBeInTheDocument()
  })
})
