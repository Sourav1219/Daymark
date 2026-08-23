// @vitest-environment node

import { describe, expect, it } from "vitest"

import { pushSubscriptionSchema } from "@/features/reminders/validation/push-validation"

const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/subscription-id",
  expirationTime: null,
  keys: {
    auth: "auth-key",
    p256dh: "public-key",
  },
}

describe("pushSubscriptionSchema", () => {
  it("accepts a trusted browser push endpoint", () => {
    expect(pushSubscriptionSchema.safeParse(subscription).success).toBe(true)
  })

  it("rejects arbitrary and insecure endpoints", () => {
    expect(
      pushSubscriptionSchema.safeParse({
        ...subscription,
        endpoint: "https://127.0.0.1/push",
      }).success,
    ).toBe(false)
    expect(
      pushSubscriptionSchema.safeParse({
        ...subscription,
        endpoint: "http://fcm.googleapis.com/fcm/send/subscription-id",
      }).success,
    ).toBe(false)
  })
})
