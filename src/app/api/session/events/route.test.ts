import { describe, expect, it } from "vitest"

import { GET } from "./route"

describe("GET /api/session/events", () => {
  it("terminates legacy EventSource clients without starting a stream", () => {
    const response = GET()

    expect(response.status).toBe(204)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.body).toBeNull()
  })
})
