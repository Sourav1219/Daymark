// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  observeRateLimitHit: vi.fn(),
}))

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class MockRatelimit {
    static slidingWindow() {
      return {}
    }

    limit = mocks.limit
  },
}))

vi.mock("@upstash/redis", () => ({
  Redis: class MockRedis {},
}))

vi.mock("@/lib/observability/metrics", () => ({
  observeRateLimitHit: mocks.observeRateLimitHit,
}))

describe("clientIp", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
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

describe("enforceRateLimit", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.test")
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token-at-least-16")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("observes one rejected request when both IP and user buckets reject", async () => {
    mocks.limit.mockResolvedValue({
      limit: 10,
      remaining: 0,
      reset: Date.now() + 60_000,
      success: false,
    })
    const { enforceRateLimit } = await import("./rate-limiter")

    const result = await enforceRateLimit({
      headers: new Headers({ "x-vercel-forwarded-for": "203.0.113.7" }),
      policy: "account",
      userId: "user-1",
    })

    expect(result?.success).toBe(false)
    expect(mocks.limit).toHaveBeenCalledTimes(2)
    expect(mocks.observeRateLimitHit).toHaveBeenCalledOnce()
    expect(mocks.observeRateLimitHit).toHaveBeenCalledWith("account")
  })

  it("prioritizes and observes a rejection when bucket counts are tied", async () => {
    const reset = Date.now() + 60_000
    mocks.limit
      .mockResolvedValueOnce({
        limit: 10,
        remaining: 0,
        reset,
        success: true,
      })
      .mockResolvedValueOnce({
        limit: 10,
        remaining: 0,
        reset,
        success: false,
      })
    const { enforceRateLimit } = await import("./rate-limiter")

    const result = await enforceRateLimit({
      headers: new Headers({ "x-vercel-forwarded-for": "203.0.113.7" }),
      policy: "account",
      userId: "user-1",
    })

    expect(result?.success).toBe(false)
    expect(mocks.observeRateLimitHit).toHaveBeenCalledOnce()
    expect(mocks.observeRateLimitHit).toHaveBeenCalledWith("account")
  })

  it("does not observe allowed requests", async () => {
    mocks.limit.mockResolvedValue({
      limit: 60,
      remaining: 59,
      reset: Date.now() + 60_000,
      success: true,
    })
    const { enforceRateLimit } = await import("./rate-limiter")

    const result = await enforceRateLimit({
      headers: new Headers({ "x-vercel-forwarded-for": "203.0.113.7" }),
      policy: "default",
    })

    expect(result?.success).toBe(true)
    expect(mocks.observeRateLimitHit).not.toHaveBeenCalled()
  })
})
