import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { AuthSuccessPopup } from "./auth-success-popup"

const replace = vi.hoisted(() => vi.fn())

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}))

describe("AuthSuccessPopup", () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it("shows a branded reset-link confirmation and dismisses automatically", () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()

    render(<AuthSuccessPopup kind="reset-link" onDismiss={onDismiss} />)

    expect(
      screen.getByRole("dialog", { name: "Check your inbox" }),
    ).toBeVisible()
    expect(screen.getByText("Secure mail sent")).toBeVisible()

    act(() => vi.advanceTimersByTime(5_000))

    expect(onDismiss).toHaveBeenCalledOnce()
    expect(replace).not.toHaveBeenCalled()
  })

  it("uses a different password celebration before redirecting to sign in", () => {
    vi.useFakeTimers()

    render(<AuthSuccessPopup destination="/sign-in" kind="password-reset" />)

    expect(
      screen.getByRole("dialog", { name: "Fresh start unlocked" }),
    ).toBeVisible()
    expect(screen.getByText("Password secured")).toBeVisible()

    act(() => vi.advanceTimersByTime(5_000))

    expect(replace).toHaveBeenCalledWith("/sign-in")
  })

  it("allows the sign in transition to happen immediately", () => {
    render(<AuthSuccessPopup destination="/sign-in" kind="password-reset" />)

    fireEvent.click(screen.getByRole("button", { name: /Sign in/iu }))

    expect(replace).toHaveBeenCalledWith("/sign-in")
  })
})
