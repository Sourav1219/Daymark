import { z } from "zod"

import { reminderChannels } from "@/features/reminders/domain/types"
import {
  normalizeRecurrenceRule,
  RecurrenceRuleError,
} from "@/features/reminders/domain/recurrence"
import {
  isValidTimezone,
  parseZonedLocalDateTime,
} from "@/features/reminders/domain/timezone"

const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u

export const timezoneSchema = z
  .string()
  .trim()
  .min(1, "Choose a timezone.")
  .max(64, "Timezone names are limited to 64 characters.")
  .refine(isValidTimezone, "Choose a valid IANA timezone.")

const reminderFields = {
  channel: z.enum(reminderChannels, { error: "Choose a reminder channel." }),
  questId: z.uuid(),
  remindAt: z.date(),
  timezone: timezoneSchema,
} as const

export const createReminderSchema = z.object(reminderFields).strict()
export const updateReminderSchema = z
  .object({
    ...reminderFields,
    expectedVersion: z.coerce.number().int().positive(),
    reminderId: z.uuid(),
  })
  .strict()
export const cancelReminderSchema = z
  .object({
    expectedVersion: z.coerce.number().int().positive(),
    reminderId: z.uuid(),
  })
  .strict()
export const markNotificationReadSchema = z
  .object({ notificationId: z.uuid() })
  .strict()
export const updateTimezoneSchema = z
  .object({
    expectedVersion: z.coerce.number().int().positive(),
    timezone: timezoneSchema,
  })
  .strict()

export type CreateReminderCommand = z.output<typeof createReminderSchema>
export type UpdateReminderCommand = z.output<typeof updateReminderSchema>
export type CancelReminderCommand = z.output<typeof cancelReminderSchema>
export type UpdateTimezoneCommand = z.output<typeof updateTimezoneSchema>

export function parseReminderLocalDateTime(
  value: FormDataEntryValue | null,
  timezone: string,
): Date | null {
  if (typeof value !== "string" || !localDateTimePattern.test(value))
    return null
  return parseZonedLocalDateTime(value, timezone)
}

export function validateRecurrenceRule(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value !== "string") return null

  try {
    return normalizeRecurrenceRule(value) || null
  } catch (error) {
    return error instanceof RecurrenceRuleError ? null : null
  }
}
