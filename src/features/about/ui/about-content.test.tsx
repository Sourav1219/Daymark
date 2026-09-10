import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AboutContent } from "./about-content"

const backHrefState = vi.hoisted(() => ({ href: "/sign-in" }))

vi.mock("@/components/legal/legal-shell-context", () => ({
  useLegalBackHref: () => backHrefState.href,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}))

describe("AboutContent", () => {
  it("renders the hero banner, brand title, and status chip", () => {
    backHrefState.href = "/sign-in"
    render(<AboutContent />)

    expect(
      screen.getByRole("heading", { name: "A calmer way to make progress." }),
    ).toBeInTheDocument()
    expect(screen.getByText("About Traketo")).toBeInTheDocument()
    expect(screen.getByText("Calm Focus")).toBeInTheDocument()
    expect(screen.getByText("Our Story & Purpose")).toBeInTheDocument()
  })

  it("renders all 6 core feature pills", () => {
    backHrefState.href = "/sign-in"
    render(<AboutContent />)

    const featuresSection = screen.getByRole("region", {
      name: "Core features",
    })

    const expectedTitles = [
      "Plan clearly",
      "Focus calmly",
      "Grow together",
      "Gentle cadence",
      "Private by design",
      "Offline ready",
    ]

    for (const title of expectedTitles) {
      expect(within(featuresSection).getByText(title)).toBeInTheDocument()
    }
  })

  it("renders philosophy comparison points and privacy commitment", () => {
    backHrefState.href = "/sign-in"
    render(<AboutContent />)

    expect(
      screen.getByRole("heading", { name: "Productivity without burnout" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText("No endless notifications or guilt trips"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Small, sustainable steps with visible clarity"),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /privacy & data centre/i }),
    ).toHaveAttribute("href", "/privacy")
  })

  it("does not render CTA buttons, sign in link, or footer links", () => {
    backHrefState.href = "/sign-in"
    render(<AboutContent />)

    expect(
      screen.queryByRole("link", { name: /get started/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: /sign in/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Terms" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Contact Support" }),
    ).not.toBeInTheDocument()
  })
})
