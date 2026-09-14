// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  getDatabase: vi.fn(),
  logSecurityEvent: vi.fn(),
  resetUserContentData: vi.fn(),
  revalidatePath: vi.fn(),
  requireWorkspaceAccess: vi.fn(),
}))

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn().mockResolvedValue(new Headers()),
}))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))
vi.mock("@/db/client", () => ({ getDatabase: mocks.getDatabase }))
vi.mock("@/features/authentication/server/authorization", () => ({
  getCurrentSessionId: vi.fn(),
  requireUser: vi.fn(),
  requireWorkspaceAccess: mocks.requireWorkspaceAccess,
}))
vi.mock(
  "@/features/authentication/mutations/account-data-reset-service",
  () => ({ resetUserContentData: mocks.resetUserContentData }),
)
vi.mock("@/lib/observability/logger", () => ({
  logSecurityEvent: mocks.logSecurityEvent,
}))
vi.mock("@/lib/rate-limit/rate-limiter", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}))

import { resetAccountDataAction } from "./account-security-actions"

function confirmation(value: string) {
  const formData = new FormData()
  formData.set("confirmation", value)
  return formData
}

describe("account data reset action", () => {
  const access = {
    role: "owner" as const,
    userId: "8245084b-e2c9-43c0-97c1-6ee8420d4a88",
    workspaceId: "2ec976e2-cae8-43d4-8eed-f91e65de1868",
  }
  const database = { kind: "test-database" }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.enforceRateLimit.mockResolvedValue(null)
    mocks.getDatabase.mockReturnValue(database)
    mocks.requireWorkspaceAccess.mockResolvedValue(access)
    mocks.resetUserContentData.mockResolvedValue({ attachmentKeys: [] })
  })

  it("rejects a reset without the explicit confirmation phrase", async () => {
    await expect(
      resetAccountDataAction(null, confirmation("delete")),
    ).resolves.toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        fieldErrors: { confirmation: ['Type "RESET" exactly to confirm.'] },
      },
      ok: false,
    })

    expect(mocks.resetUserContentData).not.toHaveBeenCalled()
  })

  it("derives the user scope on the server and invalidates the app after reset", async () => {
    await expect(
      resetAccountDataAction(null, confirmation(" reset ")),
    ).resolves.toEqual({ data: { reset: true }, ok: true })

    expect(mocks.resetUserContentData).toHaveBeenCalledWith(database, access)
    expect(mocks.logSecurityEvent).toHaveBeenCalledWith("account.data_reset", {
      userId: access.userId,
      workspaceId: access.workspaceId,
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout")
  })
})
