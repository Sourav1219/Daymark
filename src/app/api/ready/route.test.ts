// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest"

const execute = vi.hoisted(() => vi.fn())
const readServerEnv = vi.hoisted(() => vi.fn())

vi.mock("@/db/client", () => ({ getDatabase: () => ({ execute }) }))
vi.mock("@/lib/env/server", () => ({ readServerEnv }))

const secret = "readiness-secret-that-is-at-least-32-characters"

function request(authorization?: string) {
  return new Request(
    "https://daymark.example.test/api/ready",
    authorization ? { headers: { authorization } } : {},
  )
}

describe("GET /api/ready", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    readServerEnv.mockReturnValue({ READINESS_SECRET: secret })
    execute.mockResolvedValue([])
  })

  it("hides the endpoint and skips database access without a valid token", async () => {
    const { GET } = await import("./route")

    for (const authorization of [undefined, "Bearer wrong-secret"]) {
      const response = await GET(request(authorization))
      expect(response.status).toBe(404)
      expect(response.headers.get("cache-control")).toBe("no-store")
    }

    expect(execute).not.toHaveBeenCalled()
  })

  it("returns only generic readiness to an authorized deployment probe", async () => {
    const { GET } = await import("./route")

    const response = await GET(request(`Bearer ${secret}`))

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    await expect(response.json()).resolves.toEqual({ status: "ready" })
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it("coalesces repeated authorized readiness checks for five seconds", async () => {
    const { GET } = await import("./route")

    await GET(request(`Bearer ${secret}`))
    await GET(request(`Bearer ${secret}`))

    expect(execute).toHaveBeenCalledTimes(1)
  })

  it("returns a generic unavailable status when the database cannot respond", async () => {
    execute.mockRejectedValue(new Error("connection refused"))
    const { GET } = await import("./route")

    const response = await GET(request(`Bearer ${secret}`))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ status: "unavailable" })
  })
})
