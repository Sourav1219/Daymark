import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import SignOutPage from "./page"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

describe("SignOutPage", () => {
  it("renders the calm signed-out page by default and preserves a safe return path", async () => {
    render(
      await SignOutPage({
        searchParams: Promise.resolve({ next: "/profile" }),
      }),
    )

    expect(
      screen.getByRole("heading", {
        name: "You have been signed out.",
      }),
    ).toBeInTheDocument()
    expect(screen.getByText("Signed Out")).toBeInTheDocument()
    expect(screen.getByText("Safe & Secure")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /Sign in again/iu }),
    ).toHaveAttribute("href", "/sign-in?mode=login&next=%2Fprofile")
  })

  it("renders the remote sign-out notice when reason is expired or remote", async () => {
    render(
      await SignOutPage({
        searchParams: Promise.resolve({
          next: "/profile",
          reason: "expired",
        }),
      }),
    )

    expect(
      screen.getByRole("heading", {
        name: "This device has been signed out.",
      }),
    ).toBeInTheDocument()
    expect(screen.getByText("Session Ended")).toBeInTheDocument()
    expect(
      screen.getByText(
        /This device was signed out from another active session/iu,
      ),
    ).toBeInTheDocument()
  })

  it("does not accept an external return URL", async () => {
    render(
      await SignOutPage({
        searchParams: Promise.resolve({ next: "https://example.com" }),
      }),
    )

    expect(
      screen.getByRole("link", { name: /Sign in again/iu }),
    ).toHaveAttribute("href", "/sign-in?mode=login&next=%2Ftoday")
  })
})
