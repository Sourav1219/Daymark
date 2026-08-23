// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest"

const readServerEnv = vi.hoisted(() => vi.fn())

vi.mock("@/lib/env/server", () => ({ readServerEnv }))

import { authorizeCronRequest } from "@/app/api/cron/cron-auth"

const env = {
  BETTER_AUTH_SECRET: "a-secure-secret-that-is-at-least-32-characters",
  BETTER_AUTH_URL: "https://questly.example.test",
  DATABASE_URL: "postgresql://localhost/questly",
  NODE_ENV: "test" as const,
}

describe("authorizeCronRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readServerEnv.mockReturnValue(env)
  })

  it("fails closed when no secret is configured", () => {
    expect(
      authorizeCronRequest(
        new Request("https://questly.example.test/api/cron/stale-timers"),
        "stale-timers",
      ),
    ).toBe(false)
  })

  it("accepts the shared secret for every cron job", () => {
    const secret = "cron-secret-that-is-at-least-32-characters"
    readServerEnv.mockReturnValue({ ...env, CRON_SECRET: secret })
    const request = new Request(
      "https://questly.example.test/api/cron/stale-rooms",
      { headers: { authorization: `Bearer ${secret}` } },
    )

    for (const job of [
      "stale-rooms",
      "stale-timers",
      "reminders",
      "attachments",
      "overdue",
      "retention",
    ] as const) {
      expect(authorizeCronRequest(request, job)).toBe(true)
    }
  })

  it("accepts the shared secret even when a job-specific secret is also configured", () => {
    const sharedSecret = "cron-secret-that-is-at-least-32-characters"
    const jobSecret = "timer-secret-that-is-at-least-16-characters"
    readServerEnv.mockReturnValue({
      ...env,
      CRON_SECRET: sharedSecret,
      CRON_SECRET_STALE_TIMERS: jobSecret,
    })

    // Vercel Cron can only send the shared CRON_SECRET, so it must keep
    // working for native jobs regardless of per-job configuration.
    expect(
      authorizeCronRequest(
        new Request("https://questly.example.test/api/cron/stale-timers", {
          headers: { authorization: `Bearer ${sharedSecret}` },
        }),
        "stale-timers",
      ),
    ).toBe(true)
    expect(
      authorizeCronRequest(
        new Request("https://questly.example.test/api/cron/stale-timers", {
          headers: { authorization: `Bearer ${jobSecret}` },
        }),
        "stale-timers",
      ),
    ).toBe(true)
  })

  it("rejects requests that match neither configured secret", () => {
    readServerEnv.mockReturnValue({
      ...env,
      CRON_SECRET: "cron-secret-that-is-at-least-32-characters",
    })

    expect(
      authorizeCronRequest(
        new Request("https://questly.example.test/api/cron/reminders", {
          headers: { authorization: "Bearer not-the-configured-secret" },
        }),
        "reminders",
      ),
    ).toBe(false)
  })
})
