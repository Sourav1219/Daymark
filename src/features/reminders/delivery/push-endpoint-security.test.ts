// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest"

const lookup = vi.hoisted(() => vi.fn())

vi.mock("node:dns/promises", () => ({ lookup }))

import {
  createTrustedPushAgent,
  isPublicPushEndpointAddress,
  parseTrustedPushEndpoint,
  UnsafePushEndpointError,
} from "@/features/reminders/delivery/push-endpoint-security"

describe("push endpoint security", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("accepts only known HTTPS browser push origins", () => {
    expect(
      parseTrustedPushEndpoint(
        "https://fcm.googleapis.com/fcm/send/subscription-id",
      ).hostname,
    ).toBe("fcm.googleapis.com")
    expect(() =>
      parseTrustedPushEndpoint("http://fcm.googleapis.com/fcm/send/id"),
    ).toThrow(UnsafePushEndpointError)
    expect(() =>
      parseTrustedPushEndpoint("https://example.test/push-subscription"),
    ).toThrow(UnsafePushEndpointError)
    expect(() =>
      parseTrustedPushEndpoint(
        "https://credential@fcm.googleapis.com/fcm/send/subscription-id",
      ),
    ).toThrow(UnsafePushEndpointError)
  })

  it("rejects loopback, private, link-local, and reserved addresses", () => {
    for (const address of [
      "127.0.0.1",
      "10.0.0.1",
      "169.254.1.1",
      "172.16.0.1",
      "192.168.1.1",
      "::1",
      "fc00::1",
      "fe80::1",
    ]) {
      expect(isPublicPushEndpointAddress(address)).toBe(false)
    }

    expect(isPublicPushEndpointAddress("8.8.8.8")).toBe(true)
    expect(isPublicPushEndpointAddress("2606:4700:4700::1111")).toBe(true)
  })

  it("refuses a trusted hostname that resolves to a private address", async () => {
    lookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }])

    await expect(
      createTrustedPushAgent(
        "https://fcm.googleapis.com/fcm/send/subscription-id",
      ),
    ).rejects.toThrow(UnsafePushEndpointError)
  })

  it("pins delivery to prevalidated public DNS results", async () => {
    lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }])

    const agent = await createTrustedPushAgent(
      "https://fcm.googleapis.com/fcm/send/subscription-id",
    )

    expect(lookup).toHaveBeenCalledWith("fcm.googleapis.com", {
      all: true,
      verbatim: true,
    })
    agent.destroy()
  })
})
