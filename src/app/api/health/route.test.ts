import { describe, expect, it } from "vitest"

import { dynamic, GET } from "./route"

describe("GET /api/health", () => {
  it("returns a CDN-cacheable liveness response without a database", async () => {
    const response = GET()
    const payload = (await response.json()) as {
      service: string
      status: string
    }

    expect(response.status).toBe(200)
    expect(dynamic).toBe("force-static")
    expect(response.headers.get("cache-control")).toContain("s-maxage")
    expect(payload.service).toBe("traketo")
    expect(payload.status).toBe("ok")
    expect(payload).not.toHaveProperty("timestamp")
  })
})
