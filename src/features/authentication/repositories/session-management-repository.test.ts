import { describe, expect, it } from "vitest"

import {
  isLocalhostSession,
  LOCALHOST_IP_PATTERN,
} from "./session-management-repository"

describe("session-management-repository - localhost filtering", () => {
  it("matches loopback IPv4, IPv6, zero-padded, and localhost strings", () => {
    const localhostIps = [
      "127.0.0.1",
      "127.0.0.2",
      "127.1.2.3",
      "::1",
      "::ffff:127.0.0.1",
      "::ffff:127.0.0.2",
      "0000:0000:0000:0000:0000:0000:0000:0000",
      "0000:0000:0000:0000:0000:0000:0000:0001",
      "0.0.0.0",
      "::",
      "localhost",
      "LOCALHOST",
    ]

    for (const ip of localhostIps) {
      expect(LOCALHOST_IP_PATTERN.test(ip)).toBe(true)
      expect(isLocalhostSession({ ipAddress: ip })).toBe(true)
    }
  })

  it("does not match real public IP addresses from the site", () => {
    const realIps = [
      "27.63.18.132",
      "128.185.168.217",
      "128.185.168.220",
      "104.28.19.45",
      "2600:1f18:4325:ca00:1::1",
    ]

    for (const ip of realIps) {
      expect(LOCALHOST_IP_PATTERN.test(ip)).toBe(false)
      expect(isLocalhostSession({ ipAddress: ip })).toBe(false)
    }
  })

  it("detects automated test user agents as localhost/dev sessions", () => {
    expect(
      isLocalhostSession({
        ipAddress: null,
        userAgent:
          "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 HeadlessChrome/151.0 Safari/537.36",
      }),
    ).toBe(true)

    expect(
      isLocalhostSession({
        ipAddress: null,
        userAgent: "Playwright/1.42.0",
      }),
    ).toBe(true)

    expect(
      isLocalhostSession({
        ipAddress: null,
        userAgent: "curl/8.4.0",
      }),
    ).toBe(true)
  })

  it("keeps real user sessions with standard browsers", () => {
    expect(
      isLocalhostSession({
        ipAddress: "27.63.18.132",
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
      }),
    ).toBe(false)

    expect(
      isLocalhostSession({
        ipAddress: "128.185.168.217",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36",
      }),
    ).toBe(false)
  })
})
