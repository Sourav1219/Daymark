"use server"

import { getDatabase } from "@/db/client"
import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { ReminderServiceError } from "@/features/reminders/domain/errors"
import { emailDeliveryEnabled } from "@/features/reminders/delivery/resend-reminder-provider"
import {
  cancelReminder,
  createReminder,
  markNotificationRead,
  updateReminder,
  type ReminderMutationSummary,
} from "@/features/reminders/mutations/reminder-mutation-service"
import { updateUserTimezone } from "@/features/reminders/mutations/user-settings-service"
import { getUserSettings } from "@/features/reminders/queries/user-settings-query-service"
import {
  cancelReminderSchema,
  createReminderSchema,
  markNotificationReadSchema,
  parseReminderLocalDateTime,
  updateReminderSchema,
  updateTimezoneSchema,
} from "@/features/reminders/validation/reminder-validation"
import {
  runActionMutation,
  validationFailure,
} from "@/lib/actions/action-helpers"
import type { ActionResult } from "@/lib/actions/action-result"

export type ReminderActionState = ActionResult<ReminderMutationSummary> | null
export type TimezoneActionState = ActionResult<{
  timezone: string
  version: number
}> | null

const reminderPaths = ["/settings", "/quests", "/today"] as const

function runReminderMutation<T>(userId: string, mutate: () => Promise<T>) {
  return runActionMutation({
    isExpectedError: (error): error is ReminderServiceError =>
      error instanceof ReminderServiceError,
    mutate,
    paths: reminderPaths,
    rateLimit: { policy: "default", userId },
    system: "Reminder",
  })
}

async function reminderFormInput(formData: FormData) {
  const access = await requireWorkspaceAccess()
  const settings = await getUserSettings(access)

  return {
    access,
    input: {
      channel: formData.get("channel"),
      questId: formData.get("questId"),
      remindAt: parseReminderLocalDateTime(
        formData.get("remindAt"),
        settings.timezone,
      ),
      timezone: settings.timezone,
    },
  }
}

function emailChannelFailure(): ReminderActionState {
  return {
    error: {
      code: "VALIDATION_ERROR",
      fieldErrors: {
        channel: [
          "Email delivery is not available in this deployment. Use In app.",
        ],
      },
      message: "Review the reminder schedule and try again.",
    },
    ok: false,
  }
}

export async function createReminderAction(
  _previousState: ReminderActionState,
  formData: FormData,
): Promise<ReminderActionState> {
  const { access, input } = await reminderFormInput(formData)
  const parsed = createReminderSchema.safeParse(input)

  if (!parsed.success) {
    return validationFailure(
      "Review the reminder schedule and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }
  if (parsed.data.channel === "email" && !emailDeliveryEnabled()) {
    return emailChannelFailure()
  }

  return runReminderMutation(access.userId, () =>
    createReminder(getDatabase(), access, parsed.data),
  )
}

export async function updateReminderAction(
  _previousState: ReminderActionState,
  formData: FormData,
): Promise<ReminderActionState> {
  const { access, input } = await reminderFormInput(formData)
  const parsed = updateReminderSchema.safeParse({
    ...input,
    expectedVersion: formData.get("expectedVersion"),
    reminderId: formData.get("reminderId"),
  })

  if (!parsed.success) {
    return validationFailure(
      "Review the reminder schedule and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }
  if (parsed.data.channel === "email" && !emailDeliveryEnabled()) {
    return emailChannelFailure()
  }

  return runReminderMutation(access.userId, () =>
    updateReminder(getDatabase(), access, parsed.data),
  )
}

export async function cancelReminderAction(input: {
  expectedVersion: number
  reminderId: string
}) {
  const access = await requireWorkspaceAccess()
  const parsed = cancelReminderSchema.safeParse(input)

  if (!parsed.success) {
    return validationFailure("The reminder request is invalid.", {})
  }

  return runReminderMutation(access.userId, () =>
    cancelReminder(getDatabase(), access, parsed.data),
  )
}

export async function updateTimezoneAction(
  _previousState: TimezoneActionState,
  formData: FormData,
): Promise<TimezoneActionState> {
  const access = await requireWorkspaceAccess()
  const parsed = updateTimezoneSchema.safeParse({
    expectedVersion: formData.get("expectedVersion"),
    timezone: formData.get("timezone"),
  })

  if (!parsed.success) {
    return validationFailure(
      "Choose a valid IANA timezone.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runReminderMutation(access.userId, () =>
    updateUserTimezone(getDatabase(), access, parsed.data),
  )
}

export async function markNotificationReadAction(input: {
  notificationId: string
}) {
  const access = await requireWorkspaceAccess()
  const parsed = markNotificationReadSchema.safeParse(input)

  if (!parsed.success) {
    return validationFailure("The notification request is invalid.", {})
  }

  return runReminderMutation(access.userId, () =>
    markNotificationRead(getDatabase(), access, parsed.data.notificationId),
  )
}
