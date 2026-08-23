"use server"

import { headers } from "next/headers"

import { getDatabase } from "@/db/client"
import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { confirmUserTimezoneRecord } from "@/features/reminders/repositories/user-settings-repository"
import { updateTimezoneSchema } from "@/features/reminders/validation/reminder-validation"
import type { ActionResult } from "@/lib/actions/action-result"
import { enforceRateLimit } from "@/lib/rate-limit/rate-limiter"

type OnboardingResult = ActionResult<{ version: number }>

export async function confirmOnboardingTimezoneAction(input: {
  expectedVersion: number
  timezone: string
}): Promise<OnboardingResult> {
  const access = await requireWorkspaceAccess()
  const parsed = updateTimezoneSchema.safeParse(input)
  if (!parsed.success) {
    return {
      error: { code: "VALIDATION_ERROR", message: "Choose a valid timezone." },
      ok: false,
    }
  }
  const limit = await enforceRateLimit({
    headers: await headers(),
    policy: "default",
    userId: access.userId,
  })
  if (limit && !limit.success) {
    return {
      error: { code: "RATE_LIMITED", message: "Too many requests." },
      ok: false,
    }
  }

  const updated = await confirmUserTimezoneRecord(
    getDatabase(),
    access,
    parsed.data,
  )
  return updated
    ? { data: { version: updated.version }, ok: true }
    : {
        error: {
          code: "CONFLICT",
          message: "Timezone settings changed. Refresh and try again.",
        },
        ok: false,
      }
}
