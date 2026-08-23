import { describe, expect, it } from "vitest"

import { GET } from "./route"

describe("GET /api/health", () => {
  it("returns a non-cacheable liveness response without a database", async () => {
    const response = GET()
    const payload = (await response.json()) as {
      service: string
      status: string
      timestamp: string
    }

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(payload.service).toBe("daymark")
    expect(payload.status).toBe("ok")
    expect(Number.isNaN(Date.parse(payload.timestamp))).toBe(false)
  })
})
