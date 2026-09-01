"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import { profileNameSchema } from "@/features/authentication/application/validation"
import { getAuth } from "@/features/authentication/server/auth"
import { requireUser } from "@/features/authentication/server/authorization"
import type { ActionResult } from "@/lib/actions/action-result"
import { validationFailure } from "@/lib/actions/action-helpers"
import { enforceRateLimit } from "@/lib/rate-limit/rate-limiter"

export type ProfileNameActionState = ActionResult<{ name: string }> | null

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
