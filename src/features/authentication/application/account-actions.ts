"use server"

import { isAPIError } from "better-auth/api"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import {
  emailChangeRequestSchema,
  emailChangeVerificationSchema,
  profileNameSchema,
} from "@/features/authentication/application/validation"
import { getAuth, withHealthyAuth } from "@/features/authentication/server/auth"
import { monitorAuthenticationEmailDelivery } from "@/features/authentication/server/authentication-email-delivery"
import { requireUser } from "@/features/authentication/server/authorization"
import type { ActionResult } from "@/lib/actions/action-result"
import { logSecurityEvent } from "@/lib/observability/logger"
import { validationFailure } from "@/lib/actions/action-helpers"
import { enforceRateLimit } from "@/lib/rate-limit/rate-limiter"

export type ProfileNameActionState = ActionResult<{ name: string }> | null
export type EmailChangeRequestActionState = ActionResult<{
  newEmail: string
}> | null
export type EmailChangeVerificationActionState = ActionResult<{
  email: string
}> | null

async function accountRateLimitFailure(userId: string) {
  const limit = await enforceRateLimit({
    headers: await headers(),
    policy: "account",
    userId,
  })
  return limit && !limit.success
    ? ({
        error: {
          code: "RATE_LIMITED",
          message: "Too many account requests. Please wait and try again.",
        },
        ok: false,
      } as const)
    : null
}

export async function updateProfileNameAction(
  _previousState: ProfileNameActionState,
  formData: FormData,
): Promise<ProfileNameActionState> {
  const parsed = profileNameSchema.safeParse({ name: formData.get("name") })

  if (!parsed.success) {
    return validationFailure(
      "Check your display name and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  const user = await requireUser()
  const limited = await accountRateLimitFailure(user.id)
  if (limited) return limited

  try {
    await getAuth().api.updateUser({
      body: { name: parsed.data.name },
      headers: await headers(),
    })
    logSecurityEvent("profile.name_updated", { userId: user.id })
    revalidatePath("/profile")

    return { data: { name: parsed.data.name }, ok: true }
  } catch {
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "Your name could not be updated. Please try again.",
      },
      ok: false,
    }
  }
}

export async function requestEmailChangeAction(
  _previousState: EmailChangeRequestActionState,
  formData: FormData,
): Promise<EmailChangeRequestActionState> {
  const parsed = emailChangeRequestSchema.safeParse({
    newEmail: formData.get("newEmail"),
  })
  if (!parsed.success) {
    return validationFailure(
      "Check the new email address and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  const user = await requireUser()
  if (parsed.data.newEmail === user.email.toLowerCase()) {
    return validationFailure(
      "Enter an email different from your current one.",
      {
        newEmail: ["This is already your account email"],
      },
    )
  }
  const limited = await accountRateLimitFailure(user.id)
  if (limited) return limited

  try {
    const requestHeaders = await headers()
    await monitorAuthenticationEmailDelivery(() =>
      withHealthyAuth((auth) =>
        auth.api.requestEmailChangeEmailOTP({
          body: { newEmail: parsed.data.newEmail },
          headers: requestHeaders,
        }),
      ),
    )
    logSecurityEvent("profile.email_change_requested", { userId: user.id })
    return { data: { newEmail: parsed.data.newEmail }, ok: true }
  } catch (error) {
    if (isAPIError(error) && [401, 403].includes(error.statusCode)) {
      return {
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message: "For security, sign in again before changing your email.",
        },
        ok: false,
      }
    }
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "We could not send the verification code. Please try again.",
      },
      ok: false,
    }
  }
}

export async function verifyEmailChangeAction(
  _previousState: EmailChangeVerificationActionState,
  formData: FormData,
): Promise<EmailChangeVerificationActionState> {
  const parsed = emailChangeVerificationSchema.safeParse({
    code: formData.get("code"),
    newEmail: formData.get("newEmail"),
  })
  if (!parsed.success) {
    return validationFailure(
      "Check the verification code and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  const user = await requireUser()
  const limited = await accountRateLimitFailure(user.id)
  if (limited) return limited

  try {
    const requestHeaders = await headers()
    await withHealthyAuth((auth) =>
      auth.api.changeEmailEmailOTP({
        body: { newEmail: parsed.data.newEmail, otp: parsed.data.code },
        headers: requestHeaders,
      }),
    )
    logSecurityEvent("profile.email_changed", { userId: user.id })
    revalidatePath("/profile")
    revalidatePath("/privacy")
    return { data: { email: parsed.data.newEmail }, ok: true }
  } catch (error) {
    if (isAPIError(error) && [401, 403].includes(error.statusCode)) {
      return {
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message: "For security, sign in again before changing your email.",
        },
        ok: false,
      }
    }
    return {
      error: {
        code: "VALIDATION_ERROR",
        fieldErrors: {
          code: [
            "That code is incorrect or expired. Request a new code and try again.",
          ],
        },
        message: "The new email could not be verified.",
      },
      ok: false,
    }
  }
}
