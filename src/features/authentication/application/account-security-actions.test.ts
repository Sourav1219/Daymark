// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  disableTwoFactor,
  enableTwoFactor,
  enforceRateLimit,
  logSecurityEvent,
  revalidatePath,
  verifyTOTP,
} = vi.hoisted(() => ({
  disableTwoFactor: vi.fn(),
  enableTwoFactor: vi.fn(),
  enforceRateLimit: vi.fn(),
  logSecurityEvent: vi.fn(),
  revalidatePath: vi.fn(),
  verifyTOTP: vi.fn(),
}))

vi.mock("better-auth/api", () => ({
  isAPIError: (error: unknown) =>
    Boolean(error && typeof error === "object" && "body" in error),
}))

vi.mock("next/cache", () => ({
  revalidatePath,
}))

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
  }),
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock("@/db/client", () => ({
  getDatabase: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  }),
}))

vi.mock("@/features/authentication/server/authorization", () => ({
  requireUser: vi.fn().mockResolvedValue({
    email: "test@example.com",
    id: "user-1",
    name: "Tester",
  }),
  requireWorkspaceAccess: vi.fn(),
}))

vi.mock("@/features/authentication/server/auth", () => ({
  bypassTwoFactorPasswordStorage: {
    run: (_val: boolean, fn: () => unknown) => fn(),
  },
  getAuth: () => ({
    api: {
      disableTwoFactor,
      enableTwoFactor,
      verifyTOTP,
    },
  }),
  preserveActiveSessionStorage: {
    run: (_val: boolean, fn: () => unknown) => fn(),
  },
}))

vi.mock("@/lib/observability/logger", () => ({
  logSecurityEvent,
}))

vi.mock("@/lib/rate-limit/rate-limiter", () => ({
  enforceRateLimit,
}))

import {
  confirmTwoFactorAction,
  disableTwoFactorAction,
  enableTwoFactorAction,
} from "./account-security-actions"

describe("enableTwoFactorAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    enforceRateLimit.mockResolvedValue({ success: true })
  })

  it("returns QR code data URL and secret key on successful setup initialization without password", async () => {
    enableTwoFactor.mockResolvedValueOnce({
      backupCodes: ["code1", "code2"],
      totpURI:
        "otpauth://totp/Traketo:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Traketo",
    })

    const result = await enableTwoFactorAction(null, new FormData())
    expect(result?.ok).toBe(true)
    if (result?.ok) {
      expect(result.data.secretKey).toBe("JBSWY3DPEHPK3PXP")
      expect(result.data.totpURI).toContain("otpauth://totp")
      expect(result.data.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/)
    }
    expect(enableTwoFactor).toHaveBeenCalled()
  })

  it("handles rate limiting properly", async () => {
    enforceRateLimit.mockResolvedValueOnce({
      limit: 10,
      remaining: 0,
      reset: 60,
      success: false,
    })

    const result = await enableTwoFactorAction(null, new FormData())
    expect(result?.ok).toBe(false)
    if (result && !result.ok) {
      expect(result.error.code).toBe("RATE_LIMITED")
    }
  })

  it("handles initialization error gracefully", async () => {
    enableTwoFactor.mockRejectedValueOnce(new Error("Network failure"))

    const result = await enableTwoFactorAction(null, new FormData())
    expect(result?.ok).toBe(false)
    if (result && !result.ok) {
      expect(result.error.message).toContain("Could not start two-factor setup")
    }
  })
})

describe("confirmTwoFactorAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    enforceRateLimit.mockResolvedValue({ success: true })
  })

  it("fails if 6-digit code is empty or invalid format", async () => {
    const formData = new FormData()
    formData.set("code", "12")

    const result = await confirmTwoFactorAction(null, formData)
    expect(result?.ok).toBe(false)
    if (result && !result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR")
    }
  })

  it("verifies code successfully and logs event", async () => {
    verifyTOTP.mockResolvedValueOnce({ status: true })

    const formData = new FormData()
    formData.set("code", "123456")

    const result = await confirmTwoFactorAction(null, formData)
    expect(result).toEqual({
      data: { enabled: true },
      ok: true,
    })
    expect(logSecurityEvent).toHaveBeenCalledWith(
      "authentication.two_factor_enabled",
      { userId: "user-1" },
    )
    expect(revalidatePath).toHaveBeenCalledWith("/profile")
  })

  it("returns validation error when code is incorrect", async () => {
    verifyTOTP.mockRejectedValueOnce({
      body: { code: "INVALID_CODE" },
    })

    const formData = new FormData()
    formData.set("code", "000000")

    const result = await confirmTwoFactorAction(null, formData)
    expect(result?.ok).toBe(false)
    if (result && !result.ok) {
      expect(result.error.fieldErrors?.code?.[0]).toContain(
        "That code is incorrect",
      )
    }
  })
})

describe("disableTwoFactorAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    enforceRateLimit.mockResolvedValue({ success: true })
  })

  it("disables 2FA without requiring password and logs event", async () => {
    disableTwoFactor.mockResolvedValueOnce({ status: true })

    const result = await disableTwoFactorAction(null, new FormData())
    expect(result).toEqual({
      data: { disabled: true },
      ok: true,
    })
    expect(disableTwoFactor).toHaveBeenCalled()
    expect(logSecurityEvent).toHaveBeenCalledWith(
      "authentication.two_factor_disabled",
      { userId: "user-1" },
    )
    expect(revalidatePath).toHaveBeenCalledWith("/profile")
  })

  it("handles disable error gracefully", async () => {
    disableTwoFactor.mockRejectedValueOnce(new Error("Server error"))

    const result = await disableTwoFactorAction(null, new FormData())
    expect(result?.ok).toBe(false)
    if (result && !result.ok) {
      expect(result.error.message).toBe(
        "Could not disable two-factor authentication.",
      )
    }
  })
})
