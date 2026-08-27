import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { SessionExpiredCard } from "./session-expired-card"

const mockPush = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}))

describe("SessionExpiredCard", () => {
  it("renders the session expired title, brand, and security reassurance", () => {
    render(<SessionExpiredCard />)

    expect(
      screen.getByRole("heading", {
        name: "Your session is missing or expired.",
      }),
    ).toBeInTheDocument()

    expect(screen.getByText("401 · Authentication Required")).toBeInTheDocument()
    expect(screen.getByText("Session Ended")).toBeInTheDocument()
    expect(screen.getByText("Security Protected")).toBeInTheDocument()
    expect(screen.getByText("Quick Re-auth")).toBeInTheDocument()
    expect(
      screen.getByText(/Your tasks, streaks & workspace progress remain completely safe/iu),
    ).toBeInTheDocument()

    const primaryCta = screen.getByRole("link", { name: /Sign in again/iu })
    expect(primaryCta).toBeInTheDocument()
    expect(primaryCta).toHaveAttribute("href", "/sign-in?next=%2Ftoday")

    expect(
      screen.getByRole("link", { name: /Go to Sign In/iu }),
    ).toHaveAttribute("href", "/sign-in")
  })

  it("navigates with current pathname when 'Sign in again' is clicked", async () => {
    const user = userEvent.setup()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        hash: "",
        pathname: "/profile",
        search: "?view=security",
      },
      writable: true,
    })

    render(<SessionExpiredCard />)

    const primaryCta = screen.getByRole("link", { name: /Sign in again/iu })
    await user.click(primaryCta)

    expect(mockPush).toHaveBeenCalledWith(
      "/sign-in?next=%2Fprofile%3Fview%3Dsecurity",
    )
  })

  it("supports custom heading and eyebrow props", () => {
    render(
      <SessionExpiredCard
        eyebrow="403 · Access Denied"
        heading="This workspace is outside your access boundary."
        description="Custom boundary description"
      />,
    )

    expect(
      screen.getByRole("heading", {
        name: "This workspace is outside your access boundary.",
      }),
    ).toBeInTheDocument()
    expect(screen.getByText("403 · Access Denied")).toBeInTheDocument()
    expect(screen.getByText("Custom boundary description")).toBeInTheDocument()
  })
})
