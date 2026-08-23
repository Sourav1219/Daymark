// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest"

const deleteSubscription = vi.hoisted(() => vi.fn())
const listSubscriptions = vi.hoisted(() => vi.fn())
const recordFailure = vi.hoisted(() => vi.fn())
const recordSuccess = vi.hoisted(() => vi.fn())
const sendNotification = vi.hoisted(() => vi.fn())
const createAgent = vi.hoisted(() => vi.fn())

vi.mock("web-push", () => ({ default: { sendNotification } }))
vi.mock("@/features/reminders/delivery/push-endpoint-security", () => ({
  createTrustedPushAgent: createAgent,
  UnsafePushEndpointError: class UnsafePushEndpointError extends Error {},
}))
vi.mock(
  "@/features/reminders/repositories/push-subscription-repository",
  () => ({
    deletePushSubscriptionByEndpoint: deleteSubscription,
    listPushSubscriptionRecords: listSubscriptions,
    recordPushDeliveryFailure: recordFailure,
    recordPushDeliverySuccess: recordSuccess,
  }),
)

import { sendPushReminder } from "@/features/reminders/delivery/web-push-reminder-provider"

describe("sendPushReminder", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createAgent.mockResolvedValue({ destroy: vi.fn() })
    recordFailure.mockResolvedValue(false)
    recordSuccess.mockResolvedValue(undefined)
  })

  it("deletes subscriptions rejected permanently by the push service", async () => {
    listSubscriptions.mockResolvedValue([
      {
        auth: "auth-key",
        endpoint: "https://fcm.googleapis.com/dead-subscription",
        expirationTime: null,
        p256dh: "public-key",
      },
    ])
    sendNotification.mockRejectedValue({ statusCode: 410 })

    await sendPushReminder({} as never, "user-id", "quest-id", {
      privateKey: "private-key",
      publicKey: "public-key",
      subject: "mailto:admin@example.test",
    })

    expect(sendNotification).toHaveBeenCalledOnce()
    expect(deleteSubscription).toHaveBeenCalledWith(
      expect.anything(),
      "https://fcm.googleapis.com/dead-subscription",
    )
  })

  it("uses a request timeout and resets failures after successful delivery", async () => {
    listSubscriptions.mockResolvedValue([
      {
        auth: "auth-key",
        endpoint: "https://fcm.googleapis.com/subscription",
        expirationTime: null,
        p256dh: "public-key",
      },
    ])
    sendNotification.mockResolvedValue({})

    await sendPushReminder({} as never, "user-id", "quest-id", {
      privateKey: "private-key",
      publicKey: "public-key",
      subject: "mailto:admin@example.test",
    })

    expect(sendNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.objectContaining({ timeout: 5_000 }),
    )
    expect(recordSuccess).toHaveBeenCalledOnce()
  })

  it("caps concurrent outbound deliveries and records transient failures", async () => {
    listSubscriptions.mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => ({
        auth: "auth-key",
        endpoint: `https://fcm.googleapis.com/subscription-${index}`,
        expirationTime: null,
        p256dh: "public-key",
      })),
    )
    let active = 0
    let maximumActive = 0
    sendNotification.mockImplementation(async () => {
      active += 1
      maximumActive = Math.max(maximumActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
      throw new Error("temporary provider failure")
    })

    await sendPushReminder({} as never, "user-id", "quest-id", {
      privateKey: "private-key",
      publicKey: "public-key",
      subject: "mailto:admin@example.test",
    })

    expect(maximumActive).toBe(4)
    expect(recordFailure).toHaveBeenCalledTimes(8)
    expect(recordFailure).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      3,
    )
  })
})
