import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { CommandMenu } from "@/components/shell/command-menu"

const push = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))

describe("CommandMenu", () => {
  it("opens from the keyboard, filters commands, and restores trigger focus", async () => {
    const user = userEvent.setup()
    render(<CommandMenu />)

    await user.keyboard("{Control>}k{/Control}")
    expect(screen.getByRole("dialog", { name: "Command menu" })).toBeVisible()
    expect(screen.getByLabelText("Search commands")).toHaveFocus()

    await user.type(screen.getByLabelText("Search commands"), "lists")
    await user.click(screen.getByRole("button", { name: /Go to Lists/u }))
    expect(push).toHaveBeenCalledWith("/gates")
    expect(
      screen.getByRole("button", { name: "Open command menu" }),
    ).toHaveFocus()
  })

  it("closes with Escape and returns focus to its trigger", async () => {
    const user = userEvent.setup()
    render(<CommandMenu />)
    const trigger = screen.getByRole("button", { name: "Open command menu" })

    await user.click(trigger)
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it("navigates to /today when pressing g then h", async () => {
    const user = userEvent.setup()
    render(<CommandMenu />)

    await user.keyboard("gh")
    expect(push).toHaveBeenCalledWith("/today")
  })

  it("triggers feedback modal when selecting Report a Problem", async () => {
    const user = userEvent.setup()
    const feedbackListener = vi.fn()
    window.addEventListener("traketo:open-feedback", feedbackListener)

    render(<CommandMenu />)
    await user.keyboard("{Control>}k{/Control}")
    await user.type(screen.getByLabelText("Search commands"), "report")
    await user.click(screen.getByRole("button", { name: /Report a Problem/u }))

    expect(feedbackListener).toHaveBeenCalledOnce()
    window.removeEventListener("traketo:open-feedback", feedbackListener)
  })
})
