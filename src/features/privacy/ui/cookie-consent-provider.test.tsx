import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  readDeadlineStorageKey,
  todayPromoStorageKey,
} from "@/features/privacy/client/optional-browser-storage"

import {
  CookieConsentProvider,
  CookieSettingsButton,
} from "./cookie-consent-provider"

const { saveCookieConsentAction } = vi.hoisted(() => ({
  saveCookieConsentAction: vi.fn(),
}))

vi.mock("@/features/privacy/application/cookie-consent-actions", () => ({
  saveCookieConsentAction: (consent: "essential" | "preferences") =>
    saveCookieConsentAction(consent),
}))

describe("CookieConsentProvider", () => {
  beforeEach(() => {
    saveCookieConsentAction.mockReset()
    const values = new Map<string, string>()
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    })
  })

  it("does not open a consent dialog automatically on load", () => {
    render(
      <CookieConsentProvider initialConsent={null}>
        <p>Page content</p>
      </CookieConsentProvider>,
    )

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByText("Page content")).toBeVisible()
  })

  it("offers decline and allow choices when opened via settings button", async () => {
    const user = userEvent.setup()
    saveCookieConsentAction.mockResolvedValue("essential")
    window.localStorage.setItem(readDeadlineStorageKey, "stored")
    window.localStorage.setItem(todayPromoStorageKey, "1")

    render(
      <CookieConsentProvider initialConsent={null}>
        <CookieSettingsButton />
      </CookieConsentProvider>,
    )

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Cookie settings/i }))

    expect(
      screen.getByRole("dialog", { name: "Cookies & privacy" }),
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Allow Cookies" })).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Decline optional cookies" }),
    ).toBeVisible()

    await user.click(
      screen.getByRole("button", { name: "Decline optional cookies" }),
    )

    await waitFor(() => {
      expect(saveCookieConsentAction).toHaveBeenCalledWith("essential")
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
    expect(window.localStorage.getItem(readDeadlineStorageKey)).toBeNull()
    expect(window.localStorage.getItem(todayPromoStorageKey)).toBeNull()
  })

  it("lets a user reopen and save allowed preferences or close with close button", async () => {
    const user = userEvent.setup()
    saveCookieConsentAction.mockResolvedValue("preferences")

    render(
      <CookieConsentProvider initialConsent="essential">
        <CookieSettingsButton />
      </CookieConsentProvider>,
    )

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    // Test close button
    await user.click(screen.getByRole("button", { name: /Cookie settings/i }))
    expect(screen.getByRole("dialog")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Close cookie settings" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    // Test saving preferences
    await user.click(screen.getByRole("button", { name: /Cookie settings/i }))
    await user.click(screen.getByRole("button", { name: "Allow Cookies" }))

    await waitFor(() => {
      expect(saveCookieConsentAction).toHaveBeenCalledWith("preferences")
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })
})
