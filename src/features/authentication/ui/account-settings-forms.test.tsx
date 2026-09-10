import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { AccountSettingsForms } from "./account-settings-forms"

const actions = vi.hoisted(() => ({
  requestEmailChangeAction: vi.fn(),
  updateProfileNameAction: vi.fn(),
  verifyEmailChangeAction: vi.fn(),
}))

vi.mock("@/features/authentication/application/account-actions", () => actions)

describe("AccountSettingsForms", () => {
  it("keeps name controls inside profile editing", async () => {
    const user = userEvent.setup()

    render(
      <AccountSettingsForms
        email="ada@example.com"
        name="Ada Lovelace"
        onUpdated={vi.fn()}
      />,
    )

    expect(screen.getByText("Profile preview")).toBeInTheDocument()
    expect(screen.getByText("ada@example.com")).toBeInTheDocument()
    expect(screen.getByText("Verified")).toBeInTheDocument()
    expect(
      screen.getByRole("textbox", { name: "New email address" }),
    ).toBeVisible()
    expect(screen.queryByText(/password/iu)).not.toBeInTheDocument()

    const nameInput = screen.getByRole("textbox", { name: "Display name" })
    await user.clear(nameInput)
    await user.type(nameInput, "Grace Hopper")
    expect(screen.getByLabelText("Profile preview")).toHaveTextContent("GH")
    expect(screen.getByLabelText("Profile preview")).toHaveTextContent(
      "Grace Hopper",
    )
  })

  it("keeps the old email until the new address passes its OTP", async () => {
    const user = userEvent.setup()
    const onUpdated = vi.fn()
    actions.requestEmailChangeAction.mockResolvedValue({
      data: { newEmail: "grace@example.com" },
      ok: true,
    })
    actions.verifyEmailChangeAction.mockResolvedValue({
      data: { email: "grace@example.com" },
      ok: true,
    })

    render(
      <AccountSettingsForms
        email="ada@example.com"
        name="Ada Lovelace"
        onUpdated={onUpdated}
      />,
    )

    await user.type(
      screen.getByRole("textbox", { name: "New email address" }),
      "grace@example.com",
    )
    await user.click(
      screen.getByRole("button", { name: "Send verification code" }),
    )

    expect(await screen.findByText("Check your new inbox")).toBeVisible()
    expect(screen.getByText("ada@example.com")).toBeVisible()
    await user.type(
      screen.getByRole("textbox", { name: "Verification code" }),
      "123456",
    )
    await user.click(screen.getByRole("button", { name: "Verify and update" }))

    expect(onUpdated).toHaveBeenCalledWith("email")
  })
})
