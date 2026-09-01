import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { AccountSettingsForms } from "./account-settings-forms"

const actions = vi.hoisted(() => ({
  updateProfileNameAction: vi.fn(),
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
    expect(screen.getByText("Locked")).toBeInTheDocument()
    expect(screen.queryByText(/password/iu)).not.toBeInTheDocument()

    const nameInput = screen.getByRole("textbox", { name: "Display name" })
    await user.clear(nameInput)
    await user.type(nameInput, "Grace Hopper")
    expect(screen.getByLabelText("Profile preview")).toHaveTextContent("GH")
    expect(screen.getByLabelText("Profile preview")).toHaveTextContent(
      "Grace Hopper",
    )
  })
})
