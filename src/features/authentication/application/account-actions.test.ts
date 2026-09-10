// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  changeEmailEmailOTP: vi.fn(),
  enforceRateLimit: vi.fn(),
  getAuth: vi.fn(),
  logSecurityEvent: vi.fn(),
  revalidatePath: vi.fn(),
  requestEmailChangeEmailOTP: vi.fn(),
  requireUser: vi.fn(),
  updateUser: vi.fn(),
  withHealthyAuth: vi.fn(),
}))

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))
vi.mock("@/features/authentication/server/auth", () => ({
  getAuth: mocks.getAuth,
  withHealthyAuth: mocks.withHealthyAuth,
}))
vi.mock("@/features/authentication/server/authorization", () => ({
  requireUser: mocks.requireUser,
}))
vi.mock(
  "@/features/authentication/server/authentication-email-delivery",
  () => ({
    monitorAuthenticationEmailDelivery: (operation: () => Promise<unknown>) =>
      operation(),
  }),
)
vi.mock("@/lib/observability/logger", () => ({
  logSecurityEvent: mocks.logSecurityEvent,
}))
vi.mock("@/lib/rate-limit/rate-limiter", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}))

import {
  requestEmailChangeAction,
  verifyEmailChangeAction,
} from "./account-actions"

function form(values: Record<string, string>) {
  const formData = new FormData()
  for (const [name, value] of Object.entries(values)) formData.set(name, value)
  return formData
}

describe("verified email change actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.enforceRateLimit.mockResolvedValue(null)
    mocks.requireUser.mockResolvedValue({
      email: "current@example.com",
      id: "8245084b-e2c9-43c0-97c1-6ee8420d4a88",
    })
    mocks.withHealthyAuth.mockImplementation((scope) =>
      scope({
        api: {
          changeEmailEmailOTP: mocks.changeEmailEmailOTP,
          requestEmailChangeEmailOTP: mocks.requestEmailChangeEmailOTP,
        },
      }),
    )
  })

  it("sends an OTP to a normalized new email without changing the account", async () => {
    mocks.requestEmailChangeEmailOTP.mockResolvedValue({ success: true })

    await expect(
      requestEmailChangeAction(null, form({ newEmail: "  NEW@Example.com " })),
    ).resolves.toEqual({ data: { newEmail: "new@example.com" }, ok: true })
    expect(mocks.requestEmailChangeEmailOTP).toHaveBeenCalledWith(
      expect.objectContaining({ body: { newEmail: "new@example.com" } }),
    )
    expect(mocks.changeEmailEmailOTP).not.toHaveBeenCalled()
  })

  it("rejects the current email before requesting a code", async () => {
    await expect(
      requestEmailChangeAction(null, form({ newEmail: "CURRENT@example.com" })),
    ).resolves.toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        fieldErrors: { newEmail: expect.any(Array) },
      },
      ok: false,
    })
    expect(mocks.requestEmailChangeEmailOTP).not.toHaveBeenCalled()
  })

  it("commits the new email only after the OTP is verified", async () => {
    mocks.changeEmailEmailOTP.mockResolvedValue({ success: true })

    await expect(
      verifyEmailChangeAction(
        null,
        form({ code: "123456", newEmail: "new@example.com" }),
      ),
    ).resolves.toEqual({ data: { email: "new@example.com" }, ok: true })
    expect(mocks.changeEmailEmailOTP).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { newEmail: "new@example.com", otp: "123456" },
      }),
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/profile")
  })
})
