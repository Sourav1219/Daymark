import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { UnauthorizedClient } from "./unauthorized-client"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
  }),
}))

describe("UnauthorizedClient", () => {
  it("renders the 401 heading, trust messaging, and navigation actions", () => {
    render(<UnauthorizedClient />)

    expect(
      screen.getByRole("heading", { name: /Sign in to continue/i }),
    ).toBeInTheDocument()
    expect(screen.getByText("Auth Required")).toBeInTheDocument()
    expect(
      screen.getByText("401 · Authentication Required"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Your data is safe — nothing was lost or deleted."),
    ).toBeInTheDocument()

    const signInLink = screen.getByRole("link", { name: /Sign in/i })
    expect(signInLink).toBeInTheDocument()

    const homeLink = screen.getByRole("link", { name: /Back to homepage/i })
    expect(homeLink).toBeInTheDocument()
    expect(homeLink).toHaveAttribute("href", "/sign-in")
  })
})
