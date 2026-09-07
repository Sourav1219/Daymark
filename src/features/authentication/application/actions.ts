"use server"

import type { Route } from "next"
import { isAPIError } from "better-auth/api"
import { eq } from "drizzle-orm"
import { createHash } from "node:crypto"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import {
  cookieConsentMaxAgeSeconds,
  cookieConsentName,
  cookieConsentValues,
} from "@/features/privacy/domain/cookie-consent"
import { withHealthyAuth } from "@/features/authentication/server/auth"
import { monitorAuthenticationEmailDelivery } from "@/features/authentication/server/authentication-email-delivery"
import { users } from "@/db/schema"
import {
  emailVerificationCodeSchema,
  emailRequestSchema,
  loginSchema,
  passwordResetSchema,
  registrationSchema,
  safeRedirectPath,
  twoFactorChallengeSchema,
} from "@/features/authentication/application/validation"
import type { ActionFailure, ActionResult } from "@/lib/actions/action-result"
import { validationFailure } from "@/lib/actions/action-helpers"
import { logSecurityEvent, logger } from "@/lib/observability/logger"
import { enforceRateLimit } from "@/lib/rate-limit/rate-limiter"

type AuthActionData = Readonly<{
  email?: string
  message: string
  verificationRequired?: boolean
}>

export type AuthActionState = ActionResult<AuthActionData> | null
export type TwoFactorActionState = AuthActionState

function registrationResponse(email: string): NonNullable<AuthActionState> {
  return {
    data: {
      email,
      message: "Enter the 6-digit code we sent to your inbox.",
      verificationRequired: true,
    },
    ok: true,
  }
}

async function grantRegistrationCookieConsent() {
  const cookieStore = await cookies()
  cookieStore.set(cookieConsentName, cookieConsentValues.preferences, {
    httpOnly: false,
    maxAge: cookieConsentMaxAgeSeconds,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
}

const minimumAccountResponseMilliseconds = 750

async function normalizeAccountTiming(startedAt: number) {
  const remaining =
    minimumAccountResponseMilliseconds - (Date.now() - startedAt)
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining))
  }
}

function loginFailure(): ActionFailure {
  return {
    ok: false,
    error: {
      code: "AUTHENTICATION_REQUIRED",
      message: "Sign-in was unsuccessful. Please try again.",
    },
  }
}

function rateLimitFailure(): ActionFailure {
  return {
    error: {
      code: "RATE_LIMITED",
      message: "Too many account requests. Please wait and try again.",
    },
    ok: false,
  }
}

function captchaFailure(): ActionFailure {
  return {
    error: {
      code: "VALIDATION_ERROR",
      message: "Complete the security check and try again.",
    },
    ok: false,
  }
}

function isCaptchaFailure(error: unknown) {
  if (!isAPIError(error)) return false
  const code = error.body?.code
  return (
    code === "MISSING_RESPONSE" ||
    code === "VERIFICATION_FAILED" ||
    code === "UNKNOWN_ERROR"
  )
}

async function authenticationHeaders(formData: FormData) {
  const requestHeaders = new Headers(await headers())
  const captchaResponse = formData.get("cf-turnstile-response")
  if (typeof captchaResponse === "string" && captchaResponse.length > 0) {
    requestHeaders.set("x-captcha-response", captchaResponse)
  }
  return requestHeaders
}

async function accountRateLimit(email: unknown) {
  const requestHeaders = await headers()
  const identity =
    typeof email === "string"
      ? createHash("sha256").update(email.trim().toLowerCase()).digest("hex")
      : undefined
  const result = await enforceRateLimit({
    headers: requestHeaders,
    policy: "account",
    ...(identity ? { userId: identity } : {}),
  })
  return result && !result.success ? rateLimitFailure() : null
}

export async function registerAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const limited = await accountRateLimit(formData.get("email"))
  if (limited) return limited
  const parsed = registrationSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return validationFailure(
      "Review the highlighted fields and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  const startedAt = Date.now()
  const callbackURL = safeRedirectPath(formData.get("next"))
  const requestHeaders = await authenticationHeaders(formData)
  let infrastructureFailure = false
  try {
    await monitorAuthenticationEmailDelivery(() =>
      withHealthyAuth(async (auth, database) => {
        const [existingAccount] = await database
          .select({ emailVerified: users.emailVerified })
          .from(users)
          .where(eq(users.email, parsed.data.email))
          .limit(1)

        if (existingAccount && !existingAccount.emailVerified) {
          await auth.api.sendVerificationOTP({
            body: {
              email: parsed.data.email,
              type: "email-verification",
            },
            headers: requestHeaders,
          })
        } else {
          await auth.api.signUpEmail({
            body: { ...parsed.data, callbackURL },
            headers: requestHeaders,
          })
        }
      }),
    )
  } catch (error) {
    if (isCaptchaFailure(error)) return captchaFailure()
    if (
      isAPIError(error) &&
      error.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
    ) {
      logger.warn("authentication.registration_existing_email", {
        emailFingerprint: createHash("sha256")
          .update(parsed.data.email.trim().toLowerCase())
          .digest("hex"),
      })
    } else {
      infrastructureFailure = true
      logger.error(
        "authentication.registration_failed",
        error instanceof Error ? error : undefined,
      )
    }
  } finally {
    await normalizeAccountTiming(startedAt)
  }

  if (infrastructureFailure) return emailServiceUnavailable()

  await grantRegistrationCookieConsent()
  return registrationResponse(parsed.data.email)
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const limited = await accountRateLimit(formData.get("email"))
  if (limited) return limited
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return validationFailure(
      "Review the highlighted fields and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  const callbackURL = safeRedirectPath(formData.get("next"))
  const requestHeaders = await authenticationHeaders(formData)
  let twoFactorRequired = false
  try {
    const result = await withHealthyAuth(async (auth) =>
      auth.api.signInEmail({
        body: { ...parsed.data, callbackURL },
        headers: requestHeaders,
      }),
    )
    twoFactorRequired =
      typeof result === "object" &&
      result !== null &&
      "twoFactorRedirect" in result &&
      result.twoFactorRedirect === true

    if (!twoFactorRequired) {
      logSecurityEvent("authentication.login_success")
    }
  } catch (error) {
    if (isCaptchaFailure(error)) return captchaFailure()
    logSecurityEvent("authentication.login_failed", {
      emailFingerprint: createHash("sha256")
        .update(parsed.data.email.trim().toLowerCase())
        .digest("hex"),
    })
    // Keep missing-account and wrong-password responses identical so the login
    // form cannot be used to discover which email addresses are registered.
    return loginFailure()
  }

  if (twoFactorRequired) {
    logSecurityEvent("authentication.two_factor_challenge_started")
    return redirect(
      `/two-factor?next=${encodeURIComponent(callbackURL)}` as Route,
    )
  }

  redirect(callbackURL)
}

export async function verifyTwoFactorAction(
  _previousState: TwoFactorActionState,
  formData: FormData,
): Promise<TwoFactorActionState> {
  const limited = await accountRateLimit(undefined)
  if (limited) return limited

  const parsed = twoFactorChallengeSchema.safeParse({
    code: formData.get("code"),
    method: formData.get("method"),
  })
  if (!parsed.success) {
    return validationFailure(
      "Check the security code and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  const trustDevice = formData.get("trustDevice") === "on"
  try {
    await withHealthyAuth(async (auth) => {
      const requestHeaders = await headers()
      if (parsed.data.method === "backup") {
        return auth.api.verifyBackupCode({
          body: { code: parsed.data.code, trustDevice },
          headers: requestHeaders,
        })
      }

      return auth.api.verifyTOTP({
        body: { code: parsed.data.code, trustDevice },
        headers: requestHeaders,
      })
    })
  } catch (error) {
    const errorCode =
      isAPIError(error) && typeof error.body?.code === "string"
        ? error.body.code
        : "UNKNOWN"

    logger.warn("authentication.two_factor_rejected", { code: errorCode })

    if (
      errorCode === "ACCOUNT_TEMPORARILY_LOCKED" ||
      errorCode === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE"
    ) {
      return rateLimitFailure()
    }

    if (
      errorCode === "INVALID_TWO_FACTOR_COOKIE" ||
      errorCode === "TWO_FACTOR_NOT_ENABLED" ||
      errorCode === "TOTP_NOT_ENABLED" ||
      errorCode === "BACKUP_CODES_NOT_ENABLED"
    ) {
      return {
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message: "Your security check expired. Sign in again to continue.",
        },
        ok: false,
      }
    }

    return {
      error: {
        code: "AUTHENTICATION_REQUIRED",
        fieldErrors: {
          code: [
            parsed.data.method === "backup"
              ? "That recovery code is invalid or has already been used."
              : "That authenticator code is incorrect. Try the newest code shown in your app.",
          ],
        },
        message: "The security code could not be verified.",
      },
      ok: false,
    }
  }

  logSecurityEvent("authentication.two_factor_verified", {
    method: parsed.data.method,
  })
  redirect(safeRedirectPath(formData.get("next")))
}

function emailRequestResponse(
  message: string,
  email?: string,
): NonNullable<AuthActionState> {
  return {
    data: {
      ...(email ? { email } : {}),
      message,
      ...(email ? { verificationRequired: true } : {}),
    },
    ok: true,
  }
}

function emailServiceUnavailable(): ActionFailure {
  return {
    error: {
      code: "INTERNAL_ERROR",
      message:
        "Email delivery is temporarily unavailable. Please try again shortly.",
    },
    ok: false,
  }
}

export async function resendVerificationAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const limited = await accountRateLimit(formData.get("email"))
  if (limited) return limited
  const parsed = emailRequestSchema.safeParse({ email: formData.get("email") })
  if (!parsed.success) {
    return validationFailure(
      "Review the highlighted field and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  const startedAt = Date.now()
  let infrastructureFailure = false
  try {
    await monitorAuthenticationEmailDelivery(() =>
      withHealthyAuth(async (auth) =>
        auth.api.sendVerificationOTP({
          body: {
            email: parsed.data.email,
            type: "email-verification",
          },
          headers: await headers(),
        }),
      ),
    )
  } catch (error) {
    // Expected API rejections stay generic to prevent account enumeration.
    // Transport, configuration, and database failures must be honest about
    // the fact that no email could be queued.
    if (!isAPIError(error) || error.statusCode >= 500) {
      infrastructureFailure = true
      logger.error(
        "authentication.verification_request_failed",
        error instanceof Error ? error : undefined,
      )
    }
  } finally {
    await normalizeAccountTiming(startedAt)
  }

  if (infrastructureFailure) return emailServiceUnavailable()

  return emailRequestResponse(
    "If this address has an unverified account, a new 6-digit code has been sent.",
    parsed.data.email,
  )
}

export async function verifyEmailCodeAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const limited = await accountRateLimit(formData.get("email"))
  if (limited) return limited
  const parsed = emailVerificationCodeSchema.safeParse({
    code: formData.get("code"),
    email: formData.get("email"),
  })
  if (!parsed.success) {
    return validationFailure(
      "Check the verification code and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  try {
    await withHealthyAuth(async (auth) =>
      auth.api.verifyEmailOTP({
        body: { email: parsed.data.email, otp: parsed.data.code },
        headers: await headers(),
      }),
    )
  } catch (error) {
    logger.warn("authentication.verification_code_rejected", {
      code:
        isAPIError(error) && typeof error.body?.code === "string"
          ? error.body.code
          : "UNKNOWN",
    })
    return {
      error: {
        code: "AUTHENTICATION_REQUIRED",
        fieldErrors: {
          code: [
            "That code is incorrect or has expired. Request a new code and try again.",
          ],
        },
        message:
          "That code is incorrect or has expired. Request a new code and try again.",
      },
      ok: false,
    }
  }

  await grantRegistrationCookieConsent()
  redirect(safeRedirectPath(formData.get("next")))
}

export async function requestPasswordResetAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const limited = await accountRateLimit(formData.get("email"))
  if (limited) return limited
  const parsed = emailRequestSchema.safeParse({ email: formData.get("email") })
  if (!parsed.success) {
    return validationFailure(
      "Review the highlighted field and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  const startedAt = Date.now()
  const requestHeaders = await authenticationHeaders(formData)
  let infrastructureFailure = false
  try {
    await monitorAuthenticationEmailDelivery(() =>
      withHealthyAuth(async (auth) =>
        auth.api.requestPasswordReset({
          body: { email: parsed.data.email, redirectTo: "/reset-password" },
          headers: requestHeaders,
        }),
      ),
    )
  } catch (error) {
    if (isCaptchaFailure(error)) return captchaFailure()
    if (!isAPIError(error) || error.statusCode >= 500) {
      infrastructureFailure = true
      logger.error(
        "authentication.password_reset_request_failed",
        error instanceof Error ? error : undefined,
      )
    }
  } finally {
    await normalizeAccountTiming(startedAt)
  }

  if (infrastructureFailure) return emailServiceUnavailable()

  return emailRequestResponse(
    "If an eligible account exists, a password-reset link has been sent.",
  )
}

export async function resetPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const limited = await accountRateLimit(undefined)
  if (limited) return limited
  const parsed = passwordResetSchema.safeParse({
    confirmPassword: formData.get("confirmPassword"),
    newPassword: formData.get("newPassword"),
    token: formData.get("token"),
  })
  if (!parsed.success) {
    return validationFailure(
      "Review the highlighted fields and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  try {
    await withHealthyAuth(async (auth) =>
      auth.api.resetPassword({
        body: {
          newPassword: parsed.data.newPassword,
          token: parsed.data.token,
        },
        headers: await headers(),
      }),
    )
  } catch (error) {
    // Every rejection returns the same message so the response never reveals
    // why a token failed — expired, already consumed, and malformed tokens are
    // indistinguishable to the caller.
    //
    // Anything that is not a Better Auth APIError is an unexpected
    // infrastructure failure. It still returns the generic message, but it is
    // now logged: a database outage used to be reported to the user as an
    // expired link while leaving no trace anywhere.
    if (!isAPIError(error)) {
      logger.error(
        "Password reset failed unexpectedly",
        error instanceof Error ? error : undefined,
      )
    }
    logSecurityEvent("authentication.password_reset_failed")

    return {
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message:
          "This password reset link is invalid or expired. Request a new one.",
      },
      ok: false,
    }
  }

  logSecurityEvent("authentication.password_reset_completed")
  return emailRequestResponse("Your password has been reset.")
}

export async function logoutAction(): Promise<never> {
  if (await accountRateLimit(undefined)) redirect("/sign-in")
  await withHealthyAuth(async (auth) =>
    auth.api.signOut({ headers: await headers() }),
  )
  redirect("/sign-out?next=%2Ftoday")
}
