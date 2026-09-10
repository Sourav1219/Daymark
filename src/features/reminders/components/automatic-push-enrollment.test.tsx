import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  AutomaticPushEnrollment,
  disablePushNotifications,
} from "./automatic-push-enrollment"

const mocks = vi.hoisted(() => ({
  savePushSubscriptionAction: vi.fn(async () => ({
    data: { subscribed: true },
    ok: true as const,
  })),
  removePushSubscriptionAction: vi.fn(async () => ({
    data: { subscribed: false },
    ok: true as const,
  })),
}))

vi.mock("@/features/reminders/application/push-actions", () => ({
  removePushSubscriptionAction: mocks.removePushSubscriptionAction,
  savePushSubscriptionAction: mocks.savePushSubscriptionAction,
}))

const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/subscription",
  toJSON: () => ({
    endpoint: "https://push.example.test/subscription",
    expirationTime: null,
    keys: { auth: "auth", p256dh: "p256dh" },
  }),
  unsubscribe: vi.fn(async () => true),
}
const getSubscription = vi.fn(
  async (): Promise<typeof subscription | null> => subscription,
)
const subscribe = vi.fn(async () => subscription)

describe("AutomaticPushEnrollment", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.savePushSubscriptionAction.mockClear()
    mocks.removePushSubscriptionAction.mockClear()
    subscription.unsubscribe.mockClear()
    getSubscription.mockClear()
    getSubscription.mockResolvedValue(subscription)
    subscribe.mockClear()
    vi.stubGlobal("Notification", { permission: "granted" })
    vi.stubGlobal("PushManager", class PushManager {})
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: vi.fn(async () => ({
          pushManager: {
            getSubscription,
            subscribe,
          },
        })),
      },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("does not repeat a successful subscription upsert after two seconds", async () => {
    render(<AutomaticPushEnrollment publicKey="test-public-key" />)

    await act(async () => undefined)
    expect(mocks.savePushSubscriptionAction).toHaveBeenCalledOnce()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })

    expect(mocks.savePushSubscriptionAction).toHaveBeenCalledOnce()
  })

  it("does not create a subscription during automatic page-load sync", async () => {
    getSubscription.mockResolvedValue(null)

    render(<AutomaticPushEnrollment publicKey="test-public-key" />)
    await act(async () => undefined)

    expect(subscribe).not.toHaveBeenCalled()
    expect(mocks.savePushSubscriptionAction).not.toHaveBeenCalled()
  })

  it("removes the server subscription and unsubscribes the browser", async () => {
    await expect(disablePushNotifications()).resolves.toBe(true)

    expect(mocks.removePushSubscriptionAction).toHaveBeenCalledWith({
      endpoint: subscription.endpoint,
    })
    expect(subscription.unsubscribe).toHaveBeenCalledOnce()
  })
})
