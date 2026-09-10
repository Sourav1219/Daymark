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
  ProfileCookieSettingsButton,
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

  it("automatically opens consent banner for new visitors with Accept all and Essential only, and no Manage choices button initially", () => {
    render(
      <CookieConsentProvider initialConsent={null}>
        <p>Page content</p>
      </CookieConsentProvider>,
    )

    expect(
      screen.getByRole("dialog", { name: "Cookies & privacy" }),
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Accept all" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Essential only" })).toBeVisible()
    expect(
      screen.queryByRole("button", { name: /Manage choices/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByText("Page content")).toBeVisible()
  })

  it("does not open consent banner automatically for returning visitors with saved consent", () => {
    const { unmount } = render(
      <CookieConsentProvider initialConsent="preferences">
        <p>Page content</p>
      </CookieConsentProvider>,
    )

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    unmount()

    render(
      <CookieConsentProvider initialConsent="essential">
        <p>Page content</p>
      </CookieConsentProvider>,
    )

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("offers equal prominence choices for Accept all and Essential only", async () => {
    const user = userEvent.setup()
    saveCookieConsentAction.mockResolvedValue("essential")
    window.localStorage.setItem(readDeadlineStorageKey, "stored")
    window.localStorage.setItem(todayPromoStorageKey, "1")

    render(
      <CookieConsentProvider initialConsent={null}>
        <p>Page content</p>
      </CookieConsentProvider>,
    )

    const acceptBtn = screen.getByRole("button", { name: "Accept all" })
    const essentialBtn = screen.getByRole("button", { name: "Essential only" })

    expect(acceptBtn).toBeVisible()
    expect(essentialBtn).toBeVisible()
    expect(acceptBtn.className).toContain("cookie-consent__btn--equal")
    expect(essentialBtn.className).toContain("cookie-consent__btn--equal")

    await user.click(essentialBtn)

    await waitFor(() => {
      expect(saveCookieConsentAction).toHaveBeenCalledWith("essential")
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
    expect(window.localStorage.getItem(readDeadlineStorageKey)).toBeNull()
    expect(window.localStorage.getItem(todayPromoStorageKey)).toBeNull()
  })

  it("saves preferences when Accept all is clicked", async () => {
    const user = userEvent.setup()
    saveCookieConsentAction.mockResolvedValue("preferences")

    render(
      <CookieConsentProvider initialConsent={null}>
        <p>Page content</p>
      </CookieConsentProvider>,
    )

    await user.click(screen.getByRole("button", { name: "Accept all" }))

    await waitFor(() => {
      expect(saveCookieConsentAction).toHaveBeenCalledWith("preferences")
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  it("allows users to open cookie preferences in profile section and manage choices", async () => {
    const user = userEvent.setup()
    saveCookieConsentAction.mockResolvedValue("preferences")

    render(
      <CookieConsentProvider initialConsent="essential">
        <ProfileCookieSettingsButton />
      </CookieConsentProvider>,
    )

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    // Click Cookie preferences inside the profile section
    await user.click(
      screen.getByRole("button", {
        name: /Cookie preferences.*Essential cookies only/i,
      }),
    )

    expect(
      screen.getByRole("dialog", { name: "Manage cookie choices" }),
    ).toBeVisible()
    expect(screen.getByRole("region", { name: "Cookie choices" })).toBeVisible()
    expect(screen.getByText("Essential cookies & storage")).toBeVisible()
    expect(screen.getByText("Always active")).toBeVisible()
    expect(screen.getByText("Optional preferences")).toBeVisible()

    const toggle = screen.getByRole("checkbox", {
      name: "Toggle optional preferences",
    })
    expect(toggle).not.toBeChecked()

    await user.click(toggle)
    expect(toggle).toBeChecked()

    await user.click(screen.getByRole("button", { name: "Save choices" }))

    await waitFor(() => {
      expect(saveCookieConsentAction).toHaveBeenCalledWith("preferences")
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  it("allows users to reopen cookie settings and withdraw consent later inside the site", async () => {
    const user = userEvent.setup()
    saveCookieConsentAction.mockResolvedValue("essential")
    window.localStorage.setItem(readDeadlineStorageKey, "stored")
    window.localStorage.setItem(todayPromoStorageKey, "1")

    render(
      <CookieConsentProvider initialConsent="preferences">
        <CookieSettingsButton />
      </CookieConsentProvider>,
    )

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    // Click Cookie settings button inside the site
    await user.click(
      screen.getByRole("button", {
        name: /Cookie settings.*Preferences allowed/i,
      }),
    )

    expect(
      screen.getByRole("dialog", { name: "Manage cookie choices" }),
    ).toBeVisible()
    expect(screen.getByText(/Optional preferences allowed/i)).toBeVisible()

    // Withdraw consent by clicking essential only
    const withdrawBtn = screen.getByRole("button", {
      name: /Essential cookies only/i,
    })
    await user.click(withdrawBtn)

    await waitFor(() => {
      expect(saveCookieConsentAction).toHaveBeenCalledWith("essential")
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
    expect(window.localStorage.getItem(readDeadlineStorageKey)).toBeNull()
    expect(window.localStorage.getItem(todayPromoStorageKey)).toBeNull()
  })

  it("lets a user close the banner via close button without saving a choice", async () => {
    const user = userEvent.setup()

    render(
      <CookieConsentProvider initialConsent={null}>
        <p>Page content</p>
      </CookieConsentProvider>,
    )

    expect(screen.getByRole("dialog")).toBeVisible()
    await user.click(
      screen.getByRole("button", { name: "Close cookie settings" }),
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(saveCookieConsentAction).not.toHaveBeenCalled()
  })
})
