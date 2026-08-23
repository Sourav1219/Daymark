// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const authorizeCronRequest = vi.hoisted(() => vi.fn())
const getDatabase = vi.hoisted(() => vi.fn())

vi.mock("@/app/api/cron/cron-auth", () => ({ authorizeCronRequest }))
vi.mock("@/db/client", () => ({ getDatabase }))

import { POST } from "@/app/api/cron/stale-timers/route"

const hourMs = 60 * 60 * 1_000

describe("stale timer cleanup Route Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-20T12:00:00.000Z"))
    authorizeCronRequest.mockReturnValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("stores the capped elapsed total once for a resumed timer", async () => {
    const lastStartedAt = new Date("2026-08-19T23:00:00.000Z")
    const timer = {
      accumulatedMs: 2 * hourMs,
      id: "timer-id",
      lastStartedAt,
      version: 4,
    }
    let updateValues: Record<string, unknown> | undefined
    const database = {
      select: () => ({
        from: () => ({
          where: async () => [timer],
        }),
      }),
      update: () => ({
        set: (values: Record<string, unknown>) => {
          updateValues = values
          return {
            where: () => ({
              returning: async () => [{ id: timer.id }],
            }),
          }
        },
      }),
    }
    getDatabase.mockReturnValue(database)

    const response = await POST(
      new Request("https://daymark.example.test/api/cron/stale-timers", {
        method: "POST",
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      closed: 1,
      partial: false,
      stale: 1,
    })
    expect(updateValues).toMatchObject({
      accumulatedMs: 12 * hourMs,
      endedAt: new Date("2026-08-20T09:00:00.000Z"),
      status: "completed",
      updatedAt: new Date("2026-08-20T12:00:00.000Z"),
      version: 5,
    })
  })
})
