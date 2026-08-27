import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import SignOutPage from "./page"

const mockReplace = vi.fn()
const mockPush = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}))

// Simulate mobile so the SessionExpiredCard is rendered (not redirected).
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false, // desktop → redirect; tests below override per-case
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

describe("SignOutPage", () => {
  it("renders the remote sign-out page and preserves a safe return path", async () => {
    // Mobile: matchMedia returns false for min-width:641px → card is shown.
    render(
      await SignOutPage({
        searchParams: Promise.resolve({ next: "/profile" }),
      }),
    )

    expect(
      screen.getByRole("heading", {
        name: "This device has been signed out.",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /Sign in again/iu }),
    ).toHaveAttribute("href", "/sign-in?next=%2Fprofile")
  })

  it("does not accept an external return URL", async () => {
    render(
      await SignOutPage({
        searchParams: Promise.resolve({ next: "https://example.com" }),
      }),
    )

    expect(
      screen.getByRole("link", { name: /Sign in again/iu }),
    ).toHaveAttribute("href", "/sign-in?next=%2Ftoday")
  })
})
