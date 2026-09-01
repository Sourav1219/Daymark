// @vitest-environment node

import { describe, expect, it, vi } from "vitest"

const logger = vi.hoisted(() => ({ error: vi.fn() }))

vi.mock("@/lib/observability/logger", () => ({ logger }))

import {
  deliverAuthenticationEmail,
  monitorAuthenticationEmailDelivery,
} from "./authentication-email-delivery"

describe("deliverAuthenticationEmail", () => {
  it("waits until the provider accepts the message", async () => {
    const send = vi.fn().mockResolvedValue(undefined)

    await deliverAuthenticationEmail(send)

    expect(send).toHaveBeenCalledOnce()
  })

  it("logs and propagates provider failures", async () => {
    const providerError = new Error("provider rejected message")

    await expect(
      deliverAuthenticationEmail(() => Promise.reject(providerError)),
    ).rejects.toBe(providerError)
    expect(logger.error).toHaveBeenCalledWith(
      "authentication.email_delivery_failed",
      providerError,
    )
  })

  it("surfaces a delivery failure swallowed by the authentication library", async () => {
    const providerError = new Error("provider rejected message")

    await expect(
      monitorAuthenticationEmailDelivery(async () => {
        await deliverAuthenticationEmail(() =>
          Promise.reject(providerError),
        ).catch(() => undefined)
      }),
    ).rejects.toBe(providerError)
  })
})
