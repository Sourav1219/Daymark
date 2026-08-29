import "server-only"

import type { Database } from "@/db/client"
import {
  ReminderProviderError,
  type ReminderDeliveryProvider,
} from "@/features/reminders/delivery/reminder-delivery-provider"
import {
  beginReminderDeliveryRecord,
  cancelInaccessibleReminders,
  claimDueReminderRecords,
  completeReminderDeliveryRecord,
  countDueReminderRecords,
  failReminderDeliveryRecord,
} from "@/features/reminders/repositories/reminder-repository"
import {
  sendPushReminder,
  type PushDeliveryConfiguration,
} from "@/features/reminders/delivery/web-push-reminder-provider"
import { logger } from "@/lib/observability/logger"

const retryDelays = [60_000, 5 * 60_000, 15 * 60_000] as const

export type ReminderProcessorSummary = Readonly<{
  cancelled: number
  delivered: number
  failed: number
  processed: number
  remainingDue: number
  retried: number
}>

function errorCode(error: unknown): string {
  return error instanceof ReminderProviderError
    ? error.code
    : "provider_unavailable"
}

export async function processDueReminders(
  database: Database,
  provider: ReminderDeliveryProvider,
  options: Readonly<{
    batchSize?: number
    now?: Date
    push?: PushDeliveryConfiguration
  }> = {},
): Promise<ReminderProcessorSummary> {
  const now = options.now ?? new Date()
  const batchSize = Math.min(Math.max(options.batchSize ?? 25, 1), 50)
  const cancelled = await cancelInaccessibleReminders(database, now)
  const claimed = await database.transaction((transaction) =>
    claimDueReminderRecords(transaction, now, batchSize),
  )
  let delivered = 0
  let failed = 0
  let retried = 0

  for (const reminder of claimed) {
    const delivery = await beginReminderDeliveryRecord(database, reminder)

    if (delivery?.status === "delivered") {
      await completeReminderDeliveryRecord(
        database,
        reminder,
        delivery.providerMessageId,
        delivery.deliveredAt ?? now,
        false,
      )
      delivered += 1
      continue
    }

    try {
      const receipt =
        reminder.channel === "email"
          ? await provider.send({
              idempotencyKey: reminder.idempotencyKey,
              recipientEmail: reminder.recipientEmail,
            })
          : { providerMessageId: null }

      await database.transaction((transaction) =>
        completeReminderDeliveryRecord(
          transaction,
          reminder,
          receipt.providerMessageId,
          now,
        ),
      )
      delivered += 1

      // Push mirrors an already-durable in-app notification. A transient push
      // outage must not overwrite the successful reminder delivery.
      if (options.push && reminder.channel === "in_app") {
        try {
          await sendPushReminder(
            database,
            reminder.userId,
            reminder.questId,
            options.push,
          )
        } catch (error) {
          logger.error(
            "Reminder push mirror failed",
            error instanceof Error ? error : undefined,
            { reminder_id: reminder.id },
          )
        }
      }
    } catch (error) {
      const code = errorCode(error)
      const attemptedCount = reminder.attemptCount + 1
      const delay =
        retryDelays[Math.min(attemptedCount - 1, retryDelays.length - 1)] ??
        15 * 60_000
      const status = await database.transaction((transaction) =>
        failReminderDeliveryRecord(
          transaction,
          reminder,
          code,
          new Date(now.getTime() + delay),
          now,
        ),
      )

      logger.error(
        "Reminder delivery failed",
        error instanceof Error ? error : undefined,
        {
          attempt: attemptedCount,
          code,
          reminder_id: reminder.id,
          terminal: status === "failed",
        },
      )
      if (status === "delivered") {
        delivered += 1
      } else if (status === "failed") {
        failed += 1
      } else {
        retried += 1
      }
    }
  }

  const remainingDue = await countDueReminderRecords(database, now)

  return {
    cancelled,
    delivered,
    failed,
    processed: claimed.length,
    remainingDue,
    retried,
  }
}
