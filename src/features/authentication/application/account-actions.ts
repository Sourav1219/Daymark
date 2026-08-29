"use server"

import { isAPIError } from "better-auth/api"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import {
  passwordChangeSchema,
  profileNameSchema,
} from "@/features/authentication/application/validation"
import { getAuth } from "@/features/authentication/server/auth"
import { requireUser } from "@/features/authentication/server/authorization"
import type { ActionResult } from "@/lib/actions/action-result"
import { validationFailure } from "@/lib/actions/action-helpers"
import { enforceRateLimit } from "@/lib/rate-limit/rate-limiter"

export type ProfileNameActionState = ActionResult<{ name: string }> | null
export type PasswordActionState = ActionResult<{ changed: true }> | null

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

export async function changePasswordAction(
  _previousState: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  const parsed = passwordChangeSchema.safeParse({
    confirmPassword: formData.get("confirmPassword"),
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  })

  if (!parsed.success) {
    return validationFailure(
      "Review the highlighted password fields.",
      parsed.error.flatten().fieldErrors,
    )
  }

  const user = await requireUser()
  const limited = await accountRateLimitFailure(user.id)
  if (limited) return limited

  try {
    await getAuth().api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    })

    return { data: { changed: true }, ok: true }
  } catch (error) {
    const authenticationFailure =
      isAPIError(error) &&
      (error.status === "BAD_REQUEST" || error.status === "UNAUTHORIZED")

    return {
      error: {
        code: authenticationFailure
          ? "AUTHENTICATION_REQUIRED"
          : "INTERNAL_ERROR",
        message: authenticationFailure
          ? "Your current password is incorrect. Try again."
          : "Your password could not be changed. Please try again.",
      },
      ok: false,
    }
  }
}
