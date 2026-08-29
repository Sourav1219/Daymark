// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  enforceRateLimit,
  findExistingAccount,
  withHealthyAuth,
  logger,
  redirect,
  requestPasswordReset,
  resetPassword,
  sendVerificationOTP,
  signInEmail,
  signUpEmail,
  verifyEmailOTP,
} = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  findExistingAccount: vi.fn(),
  withHealthyAuth: vi.fn(),
  logger: { error: vi.fn(), warn: vi.fn() },
  redirect: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  sendVerificationOTP: vi.fn(),
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  verifyEmailOTP: vi.fn(),
}))

vi.mock("better-auth/api", () => ({
  isAPIError: (error: unknown) =>
    Boolean(error && typeof error === "object" && "body" in error),
}))
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))
vi.mock("next/navigation", () => ({ redirect }))
vi.mock("@/features/authentication/server/auth", () => ({ withHealthyAuth }))
vi.mock("@/lib/observability/logger", () => ({ logger }))
vi.mock("@/lib/rate-limit/rate-limiter", () => ({ enforceRateLimit }))

import {
  loginAction,
  registerAction,
  requestPasswordResetAction,
  resendVerificationAction,
  resetPasswordAction,
  verifyEmailCodeAction,
} from "@/features/authentication/application/actions"

const authenticationDatabase = {
  select: () => ({
    from: () => ({
      where: () => ({ limit: findExistingAccount }),
    }),
  }),
}

function loginForm() {
  const form = new FormData()
  form.set("email", "person@example.test")
  form.set("password", "correct-horse-battery-staple")
  return form
}

function registrationForm() {
  const form = new FormData()
  form.set("email", "person@example.test")
  form.set("name", "Person")
  form.set("password", "correct-horse-battery-staple")
  return form
}

async function register() {
  const result = registerAction(null, registrationForm())
  await vi.advanceTimersByTimeAsync(750)
  return result
}

describe("registerAction", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    enforceRateLimit.mockResolvedValue(null)
    findExistingAccount.mockResolvedValue([])
    withHealthyAuth.mockImplementation((scope) =>
      scope(
        { api: { sendVerificationOTP, signUpEmail } },
        authenticationDatabase,
      ),
    )
  })

  it("returns the same generic response for new and existing addresses", async () => {
    signUpEmail.mockResolvedValueOnce({ user: { id: "new-user" } })
    const created = await register()

    findExistingAccount.mockResolvedValueOnce([{ emailVerified: false }])
    signUpEmail.mockResolvedValueOnce({ user: { id: "synthetic-user" } })
    const existing = await register()

    expect(existing).toEqual(created)
    expect(created).toEqual({
      data: {
        email: "person@example.test",
        message: "Enter the 6-digit code we sent to your inbox.",
        verificationRequired: true,
      },
      ok: true,
    })
    expect(redirect).not.toHaveBeenCalled()
    expect(sendVerificationOTP).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          email: "person@example.test",
          type: "email-verification",
        },
      }),
    )
  })

  it("does not resolve before the normalized response floor", async () => {
    signUpEmail.mockResolvedValue({ user: { id: "new-user" } })
    let settled = false
    const result = registerAction(null, registrationForm()).finally(() => {
      settled = true
    })

    await vi.advanceTimersByTimeAsync(749)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await result
    expect(settled).toBe(true)
  })
})

describe("loginAction", () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    enforceRateLimit.mockResolvedValue(null)
    withHealthyAuth.mockImplementation((scope) =>
      scope({ api: { signInEmail } }),
    )
  })

  it("returns one neutral response for every authentication failure", async () => {
    signInEmail.mockRejectedValueOnce({
      body: { code: "INVALID_EMAIL_OR_PASSWORD" },
    })
    const invalidCredentials = await loginAction(null, loginForm())

    signInEmail.mockRejectedValueOnce({
      body: { code: "USER_BANNED" },
    })
    const disabledAccount = await loginAction(null, loginForm())

    expect(disabledAccount).toEqual(invalidCredentials)
    expect(invalidCredentials).toEqual({
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Sign-in was unsuccessful. Please try again.",
      },
      ok: false,
    })
    expect(redirect).not.toHaveBeenCalled()
  })
})

function emailForm() {
  const form = new FormData()
  form.set("email", "person@example.test")
  return form
}

async function finishNormalizedRequest<T>(request: Promise<T>) {
  await vi.advanceTimersByTimeAsync(750)
  return request
}

describe("account email requests", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    enforceRateLimit.mockResolvedValue(null)
    withHealthyAuth.mockImplementation((scope) =>
      scope({ api: { requestPasswordReset, sendVerificationOTP } }),
    )
  })

  it("reports infrastructure failure instead of claiming verification was sent", async () => {
    sendVerificationOTP.mockResolvedValueOnce({ status: true })
    const sent = await finishNormalizedRequest(
      resendVerificationAction(null, emailForm()),
    )
    sendVerificationOTP.mockRejectedValueOnce(new Error("provider down"))
    const failed = await finishNormalizedRequest(
      resendVerificationAction(null, emailForm()),
    )

    expect(failed).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message:
          "Email delivery is temporarily unavailable. Please try again shortly.",
      },
      ok: false,
    })
    expect(sent).toEqual({
      data: {
        email: "person@example.test",
        message:
          "If this address has an unverified account, a new 6-digit code has been sent.",
        verificationRequired: true,
      },
      ok: true,
    })
  })

  it("returns a generic password-reset response for every address", async () => {
    requestPasswordReset.mockResolvedValue({ status: true })

    await expect(
      finishNormalizedRequest(requestPasswordResetAction(null, emailForm())),
    ).resolves.toEqual({
      data: {
        message:
          "If an eligible account exists, a password-reset link has been sent.",
      },
      ok: true,
    })
    expect(requestPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          email: "person@example.test",
          redirectTo: "/reset-password",
        },
      }),
    )
  })

  it("reports a password-reset delivery outage", async () => {
    requestPasswordReset.mockRejectedValue(new Error("provider down"))

    await expect(
      finishNormalizedRequest(requestPasswordResetAction(null, emailForm())),
    ).resolves.toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message:
          "Email delivery is temporarily unavailable. Please try again shortly.",
      },
      ok: false,
    })
  })
})

describe("verifyEmailCodeAction", () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    enforceRateLimit.mockResolvedValue(null)
    withHealthyAuth.mockImplementation((scope) =>
      scope({ api: { verifyEmailOTP } }),
    )
  })

  it("verifies a valid code and enters the requested app page", async () => {
    verifyEmailOTP.mockResolvedValue({ status: true })
    const form = emailForm()
    form.set("code", "123456")
    form.set("next", "/quests")

    await verifyEmailCodeAction(null, form)

    expect(verifyEmailOTP).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { email: "person@example.test", otp: "123456" },
      }),
    )
    expect(redirect).toHaveBeenCalledWith("/quests")
  })

  it("returns one safe error for an invalid or expired code", async () => {
    verifyEmailOTP.mockRejectedValue({ body: { code: "INVALID_OTP" } })
    const form = emailForm()
    form.set("code", "123456")

    await expect(verifyEmailCodeAction(null, form)).resolves.toMatchObject({
      error: {
        code: "AUTHENTICATION_REQUIRED",
        fieldErrors: { code: [expect.stringContaining("incorrect")] },
      },
      ok: false,
    })
    expect(redirect).not.toHaveBeenCalled()
  })
})

describe("resetPasswordAction", () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    enforceRateLimit.mockResolvedValue(null)
    withHealthyAuth.mockImplementation((scope) =>
      scope({ api: { resetPassword } }),
    )
  })

  it("uses the one-time token and redirects after a successful reset", async () => {
    resetPassword.mockResolvedValue({ status: true })
    const form = new FormData()
    form.set("token", "one-time-reset-token-123456")
    form.set("newPassword", "correct-horse-battery-staple")
    form.set("confirmPassword", "correct-horse-battery-staple")

    await resetPasswordAction(null, form)

    expect(resetPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          newPassword: "correct-horse-battery-staple",
          token: "one-time-reset-token-123456",
        },
      }),
    )
    expect(redirect).toHaveBeenCalledWith("/sign-in?passwordReset=1")
  })

  it("does not expose why a reset token was rejected", async () => {
    resetPassword.mockRejectedValue(new Error("token consumed"))
    const form = new FormData()
    form.set("token", "one-time-reset-token-123456")
    form.set("newPassword", "correct-horse-battery-staple")
    form.set("confirmPassword", "correct-horse-battery-staple")

    await expect(resetPasswordAction(null, form)).resolves.toMatchObject({
      error: { code: "AUTHENTICATION_REQUIRED" },
      ok: false,
    })
  })
})
