import "server-only"

import { and, inArray, lte } from "drizzle-orm"

import type { DatabaseExecutor } from "@/db/client"
import { inAppNotifications, reminderDeliveries, reminders } from "@/db/schema"

export type TerminalReminderRetentionResult = Readonly<{
  inAppNotifications: number
  reminderDeliveries: number
  reminders: number
}>

const TERMINAL_STATUSES = ["delivered", "cancelled", "failed"] as const

/**
 * Removes terminal reminders past the retention window together with their
 * delivery records and in-app notifications; pending, processing, and
 * retrying reminders are never touched.
 */
export async function deleteTerminalRemindersBefore(
  database: DatabaseExecutor,
  cutoff: Date,
): Promise<TerminalReminderRetentionResult> {
  const doomed = await database
    .select({ id: reminders.id })
    .from(reminders)
    .where(
      and(
        inArray(reminders.status, [...TERMINAL_STATUSES]),
        lte(reminders.updatedAt, cutoff),
      ),
    )

  if (doomed.length === 0) {
    return { inAppNotifications: 0, reminderDeliveries: 0, reminders: 0 }
  }

  const doomedIds = doomed.map((reminder) => reminder.id)

  const notifications = await database
    .delete(inAppNotifications)
    .where(inArray(inAppNotifications.reminderId, doomedIds))
    .returning({ id: inAppNotifications.id })

  const deliveries = await database
    .delete(reminderDeliveries)
    .where(inArray(reminderDeliveries.reminderId, doomedIds))
    .returning({ id: reminderDeliveries.id })

  // Re-check the status so a reminder promoted back into the retry loop
  // between the select and this delete survives the sweep.
  const deletedReminders = await database
    .delete(reminders)
    .where(
      and(
        inArray(reminders.id, doomedIds),
        inArray(reminders.status, [...TERMINAL_STATUSES]),
      ),
    )
    .returning({ id: reminders.id })

  return {
    inAppNotifications: notifications.length,
    reminderDeliveries: deliveries.length,
    reminders: deletedReminders.length,
  }
}
