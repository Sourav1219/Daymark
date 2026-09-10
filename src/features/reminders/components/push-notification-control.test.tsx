import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PushNotificationControl } from "./push-notification-control"

const mocks = vi.hoisted(() => ({
  disablePushNotifications: vi.fn(async () => true),
  enablePushNotifications: vi.fn(async () => true),
  getActivePushSubscription: vi.fn(
    async (): Promise<PushSubscription | null> => null,
  ),
  supportsPushNotifications: vi.fn(() => true),
}))

vi.mock("./automatic-push-enrollment", () => mocks)

describe("PushNotificationControl", () => {
  const requestPermission = vi.fn(
    async () => "granted" as NotificationPermission,
  )

  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockClear())
    requestPermission.mockClear()
    mocks.getActivePushSubscription.mockResolvedValue(null)
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("explains the benefit before requesting browser permission", async () => {
    const user = userEvent.setup()
    render(<PushNotificationControl publicKey="test-public-key" />)

    const enableButton = await screen.findByRole("button", {
      name: "Enable notifications",
    })
    expect(requestPermission).not.toHaveBeenCalled()

    await user.click(enableButton)

    expect(
      screen.getByRole("alertdialog", {
        name: "Enable browser notifications?",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/only reminders you create are sent/iu),
    ).toBeInTheDocument()
    expect(requestPermission).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole("button", { name: "Continue to browser" }),
    )

    await waitFor(() => expect(requestPermission).toHaveBeenCalledOnce())
    expect(mocks.enablePushNotifications).toHaveBeenCalledWith(
      "test-public-key",
    )
    expect(
      await screen.findByRole("button", { name: "Disable notifications" }),
    ).toBeInTheDocument()
  })

  it("keeps notifications off when the user chooses Not now", async () => {
    const user = userEvent.setup()
    render(<PushNotificationControl publicKey="test-public-key" />)

    await user.click(
      await screen.findByRole("button", { name: "Enable notifications" }),
    )
    await user.click(screen.getByRole("button", { name: "Not now" }))

    expect(requestPermission).not.toHaveBeenCalled()
    expect(mocks.enablePushNotifications).not.toHaveBeenCalled()
    expect(
      screen.getByRole("button", { name: "Enable notifications" }),
    ).toBeInTheDocument()
  })

  it("offers an easy disable control for an active subscription", async () => {
    const user = userEvent.setup()
    Object.defineProperty(Notification, "permission", {
      configurable: true,
      value: "granted",
    })
    mocks.getActivePushSubscription.mockResolvedValue({} as PushSubscription)
    render(<PushNotificationControl publicKey="test-public-key" />)

    await user.click(
      await screen.findByRole("button", { name: "Disable notifications" }),
    )

    await waitFor(() =>
      expect(mocks.disablePushNotifications).toHaveBeenCalledOnce(),
    )
    expect(
      await screen.findByRole("button", { name: "Enable notifications" }),
    ).toBeInTheDocument()
  })
})
