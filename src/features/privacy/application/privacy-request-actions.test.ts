// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createPrivacyRequest: vi.fn(),
  enforceRateLimit: vi.fn(),
  getCurrentUser: vi.fn(),
  getDatabase: vi.fn(),
  logSecurityEvent: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))
vi.mock("@/db/client", () => ({ getDatabase: mocks.getDatabase }))
vi.mock("@/features/authentication/server/authorization", () => ({
  getCurrentUser: mocks.getCurrentUser,
}))
vi.mock("@/features/privacy/repositories/privacy-request-repository", () => ({
  createPrivacyRequest: mocks.createPrivacyRequest,
}))
vi.mock("@/lib/observability/logger", () => ({
  logSecurityEvent: mocks.logSecurityEvent,
}))
vi.mock("@/lib/rate-limit/rate-limiter", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}))

import { submitPrivacyRequestAction } from "./privacy-request-actions"

function requestForm(details = "Please correct my recorded legal name.") {
  const formData = new FormData()
  formData.set("details", details)
  formData.set("guestEmail", "spoofed@example.com")
  formData.set("type", "correction")
  return formData
}

describe("submitPrivacyRequestAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.enforceRateLimit.mockResolvedValue(null)
    mocks.getDatabase.mockReturnValue({})
    mocks.getCurrentUser.mockResolvedValue({
      email: "owner@example.com",
      id: "8245084b-e2c9-43c0-97c1-6ee8420d4a88",
    })
    mocks.createPrivacyRequest.mockImplementation((_database, input) =>
      Promise.resolve({
        createdAt: "2026-09-11T00:00:00.000Z",
        details: input.details,
        id: "2f311add-12a2-419f-9445-d4e8499a1ab0",
        status: "submitted",
        ticketNumber: input.ticketNumber,
        type: "Correction & Rectification",
      }),
    )
  })

  it("persists an authenticated request under the session identity", async () => {
    const result = await submitPrivacyRequestAction(null, requestForm())

    expect(result).toMatchObject({
      data: {
        request: {
          status: "submitted",
          type: "Correction & Rectification",
        },
      },
      ok: true,
    })
    expect(mocks.createPrivacyRequest).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        requesterEmail: "owner@example.com",
        type: "correction",
        userId: "8245084b-e2c9-43c0-97c1-6ee8420d4a88",
      }),
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/privacy")
  })

  it("rejects incomplete details before touching authentication or storage", async () => {
    await expect(
      submitPrivacyRequestAction(null, requestForm("Too short")),
    ).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
      ok: false,
    })
    expect(mocks.getCurrentUser).not.toHaveBeenCalled()
    expect(mocks.createPrivacyRequest).not.toHaveBeenCalled()
  })
})
