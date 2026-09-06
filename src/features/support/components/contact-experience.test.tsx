import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ContactExperience } from "./contact-experience"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}))

describe("ContactExperience", () => {
  it("renders name and email inputs prefilled when user info is supplied", () => {
    render(
      <ContactExperience
        initialEmail="user@example.com"
        initialName="Alice Doe"
      />,
    )

    expect(screen.queryByText("Verified Account")).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText("What should we call you?")).toHaveValue(
      "Alice Doe",
    )
    expect(screen.getByPlaceholderText("Where should we reply?")).toHaveValue(
      "user@example.com",
    )
  })

  it("renders name and email inputs when user is anonymous", () => {
    render(<ContactExperience />)

    expect(
      screen.getByPlaceholderText("What should we call you?"),
    ).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText("Where should we reply?"),
    ).toBeInTheDocument()
  })

  it("dynamically shows support@traketo.com for product and privacy@traketo.com for privacy", async () => {
    const user = userEvent.setup()
    render(<ContactExperience />)

    // Default topic is "account" -> support@traketo.com
    expect(screen.getByText("support@traketo.com")).toBeInTheDocument()

    // Select Privacy
    const select = screen.getByRole("combobox")
    await user.selectOptions(select, "privacy")

    expect(screen.getByText("privacy@traketo.com")).toBeInTheDocument()
  })

  it("copies email address to clipboard on button click", async () => {
    const user = userEvent.setup()
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: writeTextMock },
      writable: true,
    })

    render(<ContactExperience />)

    const copyBtn = screen.getByRole("button", { name: /Copy email/i })
    await user.click(copyBtn)

    expect(writeTextMock).toHaveBeenCalledWith("support@traketo.com")
    expect(screen.getByText("Copied")).toBeInTheDocument()
  })
})
