import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import SignOutPage from "./page"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

describe("SignOutPage", () => {
  it("renders the remote sign-out page and preserves a safe return path", async () => {
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
