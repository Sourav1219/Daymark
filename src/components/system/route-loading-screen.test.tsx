import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { RouteLoadingScreen } from "./route-loading-screen"

const navigationState = vi.hoisted(() => ({ pathname: "/quests" }))

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useRouter: () => ({ back: vi.fn() }),
}))

describe("RouteLoadingScreen", () => {
  beforeEach(() => {
    navigationState.pathname = "/quests"
  })

  it("keeps a Tasks refresh visually on Tasks", () => {
    render(<RouteLoadingScreen />)

    expect(screen.getByRole("status", { name: "Loading Tasks" })).toBeVisible()
    expect(screen.getByRole("heading", { name: "Tasks" })).toBeVisible()
    expect(screen.queryByText("Loading your day")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Tasks" })).toHaveAttribute(
      "aria-current",
      "page",
    )
  })

  it("renders destination-specific raw content for Progress", () => {
    navigationState.pathname = "/progress"

    render(<RouteLoadingScreen />)

    expect(
      screen.getByRole("status", { name: "Loading Your progress" }),
    ).toBeVisible()
    expect(screen.getByText("Personal growth")).toBeVisible()
    expect(screen.getByRole("link", { name: "Progress" })).toHaveAttribute(
      "aria-current",
      "page",
    )
  })

  it.each([
    ["/cleared", "Loading Completed", ".quest-search-tools"],
    ["/timer", "Loading Timer", ".timer-focus-card"],
    ["/progress", "Loading Your progress", ".progress-summary-card"],
    ["/profile", "Loading Your profile", ".profile-hero"],
    ["/settings", "Loading Settings", "[data-slot='card']"],
    ["/gates", "Loading Lists", "[data-slot='card']"],
    ["/labels", "Loading Labels", "[data-slot='card']"],
    ["/contact", "Loading Contact us", ".contact-form"],
    ["/app/workspaces/workspace-1", "Loading workspace", "[data-slot='card']"],
  ])(
    "keeps the %s fallback on the destination page geometry",
    (pathname, accessibleName, productionSelector) => {
      navigationState.pathname = pathname

      const { container } = render(<RouteLoadingScreen />)

      expect(screen.getByRole("status", { name: accessibleName })).toBeVisible()
      expect(container.querySelector(productionSelector)).toBeInTheDocument()
      expect(container.querySelector(".exact-route-loading")).toBeVisible()
    },
  )

  it("matches the Tasks creation shell instead of a generic card list", () => {
    const { container } = render(<RouteLoadingScreen />)

    expect(container.querySelector(".quest-studio")).toBeVisible()
    expect(container.querySelector(".quest-create-card")).toBeVisible()
    expect(container.querySelectorAll("[role='tab']")).toHaveLength(3)
    expect(container.querySelector(".route-loading__cards")).toBeNull()
  })

  it("does not show the signed-in shell on public account pages", () => {
    navigationState.pathname = "/sign-in"

    render(<RouteLoadingScreen />)

    expect(
      screen.getByRole("status", { name: "Opening your account" }),
    ).toBeVisible()
    expect(
      screen.queryByRole("navigation", { name: "Primary navigation" }),
    ).not.toBeInTheDocument()
  })
})
