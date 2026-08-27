import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { BottomTabBar } from "./bottom-tab-bar"

const navigationState = vi.hoisted(() => ({
  pathname: "/profile",
  search: "",
}))

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useSearchParams: () => new URLSearchParams(navigationState.search),
}))

describe("BottomTabBar", () => {
  beforeEach(() => {
    navigationState.pathname = "/profile"
    navigationState.search = ""
  })

  it("exposes Profile as a direct tab instead of a More menu", () => {
    const { container } = render(<BottomTabBar />)

    expect(screen.getAllByRole("link")).toHaveLength(5)
    expect(
      screen.queryByRole("button", { name: /more/iu }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/profile",
    )
    expect(screen.getByRole("navigation")).toHaveAttribute(
      "data-active-index",
      "4",
    )
    expect(container.querySelector(".tab-liquid-lens")).toHaveAttribute(
      "data-visible",
      "true",
    )
  })

  it("keeps primary destinations canonical when another page has a date", () => {
    navigationState.pathname = "/quests"
    navigationState.search = "date=2026-08-13"

    render(<BottomTabBar />)

    expect(screen.getByRole("link", { name: "Progress" })).toHaveAttribute(
      "href",
      "/progress",
    )
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/profile",
    )
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/today",
    )
  })
})
