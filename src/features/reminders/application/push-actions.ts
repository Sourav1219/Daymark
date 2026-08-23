"use server"

import { getDatabase } from "@/db/client"
import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { ReminderServiceError } from "@/features/reminders/domain/errors"
import {
  deletePushSubscriptionRecord,
  savePushSubscriptionRecord,
} from "@/features/reminders/repositories/push-subscription-repository"
import {
  pushSubscriptionSchema,
  removePushSubscriptionSchema,
} from "@/features/reminders/validation/push-validation"
import type { ActionResult } from "@/lib/actions/action-result"
import { runActionMutation } from "@/lib/actions/action-helpers"
import { ResourceQuotaError } from "@/lib/resource-quotas"

type PushActionResult = ActionResult<{ subscribed: boolean }>

function isExpectedError(
  error: unknown,
): error is ResourceQuotaError | ReminderServiceError {
  return (
    error instanceof ResourceQuotaError || error instanceof ReminderServiceError
  )
}

export async function savePushSubscriptionAction(
  input: unknown,
): Promise<PushActionResult> {
  const access = await requireWorkspaceAccess()
  const parsed = pushSubscriptionSchema.safeParse(input)
  if (!parsed.success) {
    return {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid push subscription.",
      },
      ok: false,
    }
  }
  return runActionMutation({
    isExpectedError,
    mutate: async () => {
      const record = await savePushSubscriptionRecord(getDatabase(), {
        auth: parsed.data.keys.auth,
        endpoint: parsed.data.endpoint,
        expirationTime: parsed.data.expirationTime
          ? new Date(parsed.data.expirationTime)
          : null,
        p256dh: parsed.data.keys.p256dh,
        userId: access.userId,
      })
      if (!record) throw new Error("Push subscription was not saved")
      return { subscribed: true }
    },
    paths: [],
    rateLimit: { policy: "pushSubscription", userId: access.userId },
    system: "Push notification",
  })
}

export async function removePushSubscriptionAction(
  input: unknown,
): Promise<PushActionResult> {
  const access = await requireWorkspaceAccess()
  const parsed = removePushSubscriptionSchema.safeParse(input)
  if (!parsed.success) {
    return {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid push subscription.",
      },
      ok: false,
    }
  }
  return runActionMutation({
    isExpectedError,
    mutate: async () => {
      await deletePushSubscriptionRecord(
        getDatabase(),
        access.userId,
        parsed.data.endpoint,
      )
      return { subscribed: false }
    },
    paths: [],
    rateLimit: { policy: "pushSubscription", userId: access.userId },
    system: "Push notification",
  })
}
