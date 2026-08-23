import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { AccountSettingsForms } from "./account-settings-forms"

const actions = vi.hoisted(() => ({
  changePasswordAction: vi.fn(),
  updateProfileNameAction: vi.fn(),
}))

vi.mock("@/features/authentication/application/account-actions", () => actions)

describe("AccountSettingsForms", () => {
  it("keeps name and password controls inside profile editing", async () => {
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
    expect(screen.getByText("Locked")).toBeInTheDocument()

    const nameInput = screen.getByRole("textbox", { name: "Display name" })
    await user.clear(nameInput)
    await user.type(nameInput, "Grace Hopper")
    expect(screen.getByLabelText("Profile preview")).toHaveTextContent("GH")
    expect(screen.getByLabelText("Profile preview")).toHaveTextContent(
      "Grace Hopper",
    )

    const currentPassword = screen.getByLabelText("Current password")
    expect(currentPassword).toHaveAttribute("type", "password")
    await user.click(
      screen.getByRole("button", { name: "Show current password" }),
    )
    expect(currentPassword).toHaveAttribute("type", "text")
    expect(
      screen.getByRole("heading", { name: "Change password" }),
    ).toBeInTheDocument()
  })
})
