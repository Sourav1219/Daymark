"use server"

import { isAPIError } from "better-auth/api"
import { createHash } from "node:crypto"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { withHealthyAuth } from "@/features/authentication/server/auth"
import {
  emailRequestSchema,
  loginSchema,
  passwordResetSchema,
  registrationSchema,
  safeRedirectPath,
} from "@/features/authentication/application/validation"
import type { ActionFailure, ActionResult } from "@/lib/actions/action-result"
import { validationFailure } from "@/lib/actions/action-helpers"
import { logger } from "@/lib/observability/logger"
import { enforceRateLimit } from "@/lib/rate-limit/rate-limiter"

export type AuthActionState = ActionResult<{ message: string }> | null

function registrationResponse(): NonNullable<AuthActionState> {
  return {
    data: {
      message:
        "If this address can be registered, a verification link has been sent. Check your inbox before signing in.",
    },
    ok: true,
  }
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
  try {
    await withHealthyAuth(async (auth) =>
      auth.api.signUpEmail({
        body: { ...parsed.data, callbackURL: "/sign-in?verified=1" },
        headers: await headers(),
      }),
    )
  } catch (error) {
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
      logger.error(
        "authentication.registration_failed",
        error instanceof Error ? error : undefined,
      )
    }
  } finally {
    await normalizeAccountTiming(startedAt)
  }

  return registrationResponse()
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

  try {
    await withHealthyAuth(async (auth) =>
      auth.api.signInEmail({
        body: { ...parsed.data, callbackURL: "/sign-in?verified=1" },
        headers: await headers(),
      }),
    )
  } catch {
    // Keep missing-account and wrong-password responses identical so the login
    // form cannot be used to discover which email addresses are registered.
    return loginFailure()
  }

  redirect(safeRedirectPath(formData.get("next")))
}

function emailRequestResponse(message: string): NonNullable<AuthActionState> {
  return { data: { message }, ok: true }
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
  try {
    await withHealthyAuth(async (auth) =>
      auth.api.sendVerificationEmail({
        body: {
          callbackURL: "/sign-in?verified=1",
          email: parsed.data.email,
        },
        headers: await headers(),
      }),
    )
  } catch (error) {
    logger.error(
      "authentication.verification_request_failed",
      error instanceof Error ? error : undefined,
    )
  } finally {
    await normalizeAccountTiming(startedAt)
  }

  return emailRequestResponse(
    "If this address has an unverified account, a verification link has been sent.",
  )
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
  try {
    await withHealthyAuth(async (auth) =>
      auth.api.requestPasswordReset({
        body: { email: parsed.data.email, redirectTo: "/reset-password" },
        headers: await headers(),
      }),
    )
  } catch (error) {
    logger.error(
      "authentication.password_reset_request_failed",
      error instanceof Error ? error : undefined,
    )
  } finally {
    await normalizeAccountTiming(startedAt)
  }

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
  } catch {
    return {
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message:
          "This password reset link is invalid or expired. Request a new one.",
      },
      ok: false,
    }
  }

  redirect("/sign-in?passwordReset=1")
}

export async function logoutAction(): Promise<never> {
  if (await accountRateLimit(undefined)) redirect("/sign-in")
  await withHealthyAuth(async (auth) =>
    auth.api.signOut({ headers: await headers() }),
  )
  redirect("/sign-in")
}
