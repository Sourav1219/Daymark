import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { PasswordResetForm } from "./password-reset-form"

const resetPasswordAction = vi.hoisted(() => vi.fn())
const replace = vi.hoisted(() => vi.fn())

vi.mock("@/features/authentication/application/actions", () => ({
  resetPasswordAction,
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}))

describe("PasswordResetForm", () => {
  it("shows the distinct password celebration before redirecting to sign in", async () => {
    resetPasswordAction.mockResolvedValue({
      data: { message: "Your password has been reset." },
      ok: true,
    })
    const user = userEvent.setup()

    render(<PasswordResetForm token="one-time-reset-token-123456" />)

    await user.type(
      screen.getByLabelText("New password"),
      "correct-horse-battery-staple",
    )
    await user.type(
      screen.getByLabelText("Confirm password"),
      "correct-horse-battery-staple",
    )
    await user.click(screen.getByRole("button", { name: "Update password" }))

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "Fresh start unlocked" }),
      ).toBeVisible()
    })
    expect(screen.getByText("Password secured")).toBeVisible()

    await user.click(screen.getByRole("button", { name: /Sign in/iu }))
    expect(replace).toHaveBeenCalledWith("/sign-in")
  })
})
