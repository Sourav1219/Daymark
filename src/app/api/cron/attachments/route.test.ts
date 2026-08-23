// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest"

const cleanup = vi.hoisted(() => vi.fn())
const readServerEnv = vi.hoisted(() => vi.fn())

vi.mock("@/db/client", () => ({ getDatabase: () => ({}) }))
vi.mock("@/features/attachments/mutations/attachment-mutation-service", () => ({
  cleanupAbandonedAttachments: cleanup,
}))
vi.mock("@/features/attachments/storage/r2-attachment-storage", () => ({
  createR2AttachmentStorage: () => ({}),
}))
vi.mock("@/lib/env/server", () => ({ readServerEnv }))

import { GET } from "./route"

const env = {
  BETTER_AUTH_SECRET: "a-secure-secret-that-is-at-least-32-characters",
  BETTER_AUTH_URL: "https://questly.example.test",
  CRON_SECRET: "cron-secret-that-is-at-least-32-characters",
  DATABASE_URL: "postgresql://localhost/questly",
  NODE_ENV: "test" as const,
  R2_ACCESS_KEY_ID: "access-key-at-least-16",
  R2_ACCOUNT_ID: "1234567890abcdef1234567890abcdef",
  R2_BUCKET_NAME: "questly-attachments",
  R2_SECRET_ACCESS_KEY: "secret-key-that-is-at-least-32-characters",
}

describe("attachment cleanup Route Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readServerEnv.mockReturnValue(env)
    cleanup.mockResolvedValue({ failed: 0, processed: 2, removed: 2 })
  })

  it("requires the scheduler bearer secret", async () => {
    const response = await GET(
      new Request("https://questly.example.test/api/cron/attachments"),
    )
    expect(response.status).toBe(401)
    expect(cleanup).not.toHaveBeenCalled()
  })

  it("rejects requests when no scheduler secret is configured", async () => {
    readServerEnv.mockReturnValue({ ...env, CRON_SECRET: undefined })

    const response = await GET(
      new Request("https://questly.example.test/api/cron/attachments"),
    )

    expect(response.status).toBe(401)
    expect(cleanup).not.toHaveBeenCalled()
  })

  it("runs bounded cleanup without caching", async () => {
    const response = await GET(
      new Request("https://questly.example.test/api/cron/attachments", {
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      }),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    await expect(response.json()).resolves.toEqual({
      failed: 0,
      processed: 2,
      removed: 2,
    })
  })

  it("is unavailable without complete R2 configuration", async () => {
    readServerEnv.mockReturnValue({ ...env, R2_BUCKET_NAME: undefined })
    const response = await GET(
      new Request("https://questly.example.test/api/cron/attachments", {
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      }),
    )
    expect(response.status).toBe(503)
  })

  it("accepts a dedicated attachment secret in addition to the shared secret", async () => {
    const dedicatedSecret = "attachment-secret-that-is-at-least-16-characters"
    readServerEnv.mockReturnValue({
      ...env,
      CRON_SECRET_ATTACHMENTS: dedicatedSecret,
    })

    // Vercel Cron can only send the shared secret, so it must keep working.
    const sharedResponse = await GET(
      new Request("https://questly.example.test/api/cron/attachments", {
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      }),
    )
    expect(sharedResponse.status).toBe(200)

    const dedicatedResponse = await GET(
      new Request("https://questly.example.test/api/cron/attachments", {
        headers: { authorization: `Bearer ${dedicatedSecret}` },
      }),
    )
    expect(dedicatedResponse.status).toBe(200)
  })
})
