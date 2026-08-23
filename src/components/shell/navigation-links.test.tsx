import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { NavigationLinks } from "./navigation-links"

vi.mock("next/navigation", () => ({
  usePathname: () => "/quests",
  useSearchParams: () => new URLSearchParams(),
}))

describe("NavigationLinks", () => {
  it("exposes every shell route and marks the current page", () => {
    render(<NavigationLinks />)

    expect(
      screen.getByRole("navigation", { name: "Primary navigation" }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole("link")).toHaveLength(9)
    expect(screen.getByRole("link", { name: "Tasks" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    )
    expect(screen.getByRole("link", { name: "Timer" })).toHaveAttribute(
      "href",
      "/timer",
    )
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/profile",
    )
  })
})
