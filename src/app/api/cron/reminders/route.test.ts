// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest"

const processor = vi.hoisted(() => vi.fn())
const readServerEnv = vi.hoisted(() => vi.fn())

vi.mock("@/db/client", () => ({ getDatabase: () => ({}) }))
vi.mock("@/features/reminders/processing/reminder-processor", () => ({
  processDueReminders: processor,
}))
vi.mock("@/features/reminders/delivery/resend-reminder-provider", () => ({
  createReminderDeliveryProvider: () => ({}),
}))
vi.mock("@/lib/env/server", () => ({ readServerEnv }))

import { GET, POST } from "@/app/api/cron/reminders/route"

const env = {
  BETTER_AUTH_SECRET: "a-secure-secret-that-is-at-least-32-characters",
  BETTER_AUTH_URL: "https://questly.example.test",
  CRON_SECRET: "cron-secret-that-is-at-least-32-characters",
  DATABASE_URL: "postgresql://localhost/questly",
  NODE_ENV: "test" as const,
}

describe("reminder scheduler Route Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readServerEnv.mockReturnValue(env)
    processor.mockResolvedValue({
      cancelled: 0,
      delivered: 1,
      failed: 0,
      processed: 1,
      remainingDue: 0,
      retried: 0,
    })
  })

  it("rejects missing and incorrect bearer credentials", async () => {
    for (const authorization of [undefined, "Bearer wrong-secret"]) {
      const response = await GET(
        new Request(
          "https://questly.example.test/api/cron/reminders",
          authorization ? { headers: { authorization } } : {},
        ),
      )
      expect(response.status).toBe(401)
    }

    expect(processor).not.toHaveBeenCalled()
  })

  it("processes authenticated GET and POST invocations without caching", async () => {
    for (const handler of [GET, POST]) {
      const response = await handler(
        new Request("https://questly.example.test/api/cron/reminders", {
          headers: { authorization: `Bearer ${env.CRON_SECRET}` },
        }),
      )
      expect(response.status).toBe(200)
      expect(response.headers.get("cache-control")).toBe("no-store")
      await expect(response.json()).resolves.toMatchObject({
        delivered: 1,
        processed: 1,
      })
    }
  })

  it("rejects requests when no deployment secret is configured", async () => {
    readServerEnv.mockReturnValue({ ...env, CRON_SECRET: undefined })
    const response = await GET(
      new Request("https://questly.example.test/api/cron/reminders"),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized.",
    })
    expect(processor).not.toHaveBeenCalled()
  })

  it("accepts a dedicated reminder secret in addition to the shared secret", async () => {
    const dedicatedSecret = "reminder-secret-that-is-at-least-16-characters"
    readServerEnv.mockReturnValue({
      ...env,
      CRON_SECRET_REMINDERS: dedicatedSecret,
    })

    // Vercel Cron can only send the shared secret, so it must keep working.
    const sharedResponse = await GET(
      new Request("https://questly.example.test/api/cron/reminders", {
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      }),
    )
    expect(sharedResponse.status).toBe(200)

    const dedicatedResponse = await GET(
      new Request("https://questly.example.test/api/cron/reminders", {
        headers: { authorization: `Bearer ${dedicatedSecret}` },
      }),
    )
    expect(dedicatedResponse.status).toBe(200)
  })
})
