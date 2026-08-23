// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("clientIp", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  async function resolveClientIp(headers: Record<string, string>) {
    const { clientIp } = await import("./rate-limiter")

    return clientIp(new Headers(headers))
  }

  it("prefers the platform-stamped Vercel header", async () => {
    await expect(
      resolveClientIp({
        "x-vercel-forwarded-for": "203.0.113.7, 70.41.3.18",
        "x-forwarded-for": "198.51.100.9",
      }),
    ).resolves.toBe("203.0.113.7")
  })

  it("ignores spoofable forwarded headers by default", async () => {
    await expect(
      resolveClientIp({
        "x-forwarded-for": "198.51.100.9",
        "x-real-ip": "198.51.100.10",
      }),
    ).resolves.toBe("unknown")
  })

  it("honors forwarded headers only when the proxy is trusted", async () => {
    vi.stubEnv("TRUST_FORWARDED_IP_HEADERS", "true")

    await expect(
      resolveClientIp({ "x-forwarded-for": "198.51.100.9" }),
    ).resolves.toBe("198.51.100.9")
    await expect(
      resolveClientIp({ "x-real-ip": "198.51.100.10" }),
    ).resolves.toBe("198.51.100.10")
  })

  it('treats "1" as an explicit trust override', async () => {
    vi.stubEnv("TRUST_FORWARDED_IP_HEADERS", "1")

    await expect(
      resolveClientIp({ "x-forwarded-for": "198.51.100.9" }),
    ).resolves.toBe("198.51.100.9")
  })

  it('treats "false" as untrusted', async () => {
    vi.stubEnv("TRUST_FORWARDED_IP_HEADERS", "false")

    await expect(
      resolveClientIp({ "x-forwarded-for": "198.51.100.9" }),
    ).resolves.toBe("unknown")
  })
})
