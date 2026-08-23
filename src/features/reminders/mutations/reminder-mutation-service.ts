import "server-only"

import type { Database, DatabaseExecutor } from "@/db/client"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { ReminderServiceError } from "@/features/reminders/domain/errors"
import {
  cancelReminderRecord,
  createReminderRecord,
  findReminderRecord,
  markNotificationReadRecord,
  updateReminderRecord,
  type ReminderRecord,
} from "@/features/reminders/repositories/reminder-repository"
import { findUserSettingsRecord } from "@/features/reminders/repositories/user-settings-repository"
import type {
  CancelReminderCommand,
  CreateReminderCommand,
  UpdateReminderCommand,
} from "@/features/reminders/validation/reminder-validation"
import { lockWorkspaceForMutation } from "@/features/workspaces/infrastructure/workspace-access-repository"
import { reminderQuotaAvailable } from "@/lib/resource-quotas"

export type ReminderMutationSummary = Readonly<{
  id: string
  status: ReminderRecord["status"]
  version: number
}>

function summary(record: ReminderRecord): ReminderMutationSummary {
  return { id: record.id, status: record.status, version: record.version }
}

function validateFuture(remindAt: Date, now: Date) {
  const delay = remindAt.getTime() - now.getTime()

  if (delay < 60_000) {
    throw new ReminderServiceError(
      "VALIDATION_ERROR",
      "Choose a reminder at least one minute in the future.",
    )
  }

  if (delay > 5 * 366 * 24 * 60 * 60_000) {
    throw new ReminderServiceError(
      "VALIDATION_ERROR",
      "Reminders can be scheduled up to five years ahead.",
    )
  }
}

async function validateChannel(
  database: DatabaseExecutor,
  access: AccessContext,
  channel: CreateReminderCommand["channel"],
) {
  if (channel !== "email") return

  const settings = await findUserSettingsRecord(database, access)
  if (!settings?.emailRemindersEnabled) {
    throw new ReminderServiceError(
      "VALIDATION_ERROR",
      "Email reminders are disabled in your settings.",
    )
  }
}

function workspaceMutation<T>(
  database: Database,
  access: AccessContext,
  mutation: (transaction: DatabaseExecutor) => Promise<T>,
): Promise<T> {
  return database.transaction(async (transaction) => {
    if (!(await lockWorkspaceForMutation(transaction, access))) {
      throw new ReminderServiceError(
        "FORBIDDEN",
        "Workspace access is no longer active.",
      )
    }

    return mutation(transaction)
  })
}

export function createReminder(
  database: Database,
  access: AccessContext,
  command: CreateReminderCommand,
  now = new Date(),
): Promise<ReminderMutationSummary> {
  validateFuture(command.remindAt, now)

  return workspaceMutation(database, access, async (transaction) => {
    if (!(await reminderQuotaAvailable(transaction, access.workspaceId))) {
      throw new ReminderServiceError(
        "VALIDATION_ERROR",
        "This workspace has reached its active reminder quota.",
      )
    }
    await validateChannel(transaction, access, command.channel)
    const created = await createReminderRecord(transaction, access, command)

    if (!created) {
      throw new ReminderServiceError(
        "NOT_FOUND",
        "Choose an active task from this workspace.",
      )
    }

    return summary(created)
  })
}

export function updateReminder(
  database: Database,
  access: AccessContext,
  command: UpdateReminderCommand,
  now = new Date(),
): Promise<ReminderMutationSummary> {
  validateFuture(command.remindAt, now)

  return workspaceMutation(database, access, async (transaction) => {
    await validateChannel(transaction, access, command.channel)
    const updated = await updateReminderRecord(transaction, access, command)
    if (updated) return summary(updated)

    const current = await findReminderRecord(
      transaction,
      access,
      command.reminderId,
    )
    if (!current) {
      throw new ReminderServiceError("NOT_FOUND", "Reminder not found.")
    }

    throw new ReminderServiceError(
      "CONFLICT",
      current.version === command.expectedVersion
        ? "Only pending reminders can be edited."
        : "The reminder was updated elsewhere. Refresh and try again.",
    )
  })
}

export function cancelReminder(
  database: Database,
  access: AccessContext,
  command: CancelReminderCommand,
): Promise<ReminderMutationSummary> {
  return workspaceMutation(database, access, async (transaction) => {
    const current = await findReminderRecord(
      transaction,
      access,
      command.reminderId,
    )

    if (!current) {
      throw new ReminderServiceError("NOT_FOUND", "Reminder not found.")
    }

    if (current.status === "cancelled") return summary(current)

    const cancelled = await cancelReminderRecord(transaction, access, command)
    if (cancelled) return summary(cancelled)

    throw new ReminderServiceError(
      "CONFLICT",
      current.version === command.expectedVersion
        ? "This reminder is already being delivered and cannot be cancelled."
        : "The reminder was updated elsewhere. Refresh and try again.",
    )
  })
}

export async function markNotificationRead(
  database: Database,
  access: AccessContext,
  notificationId: string,
): Promise<{ id: string }> {
  const updated = await markNotificationReadRecord(
    database,
    access,
    notificationId,
  )

  if (!updated) {
    throw new ReminderServiceError(
      "NOT_FOUND",
      "Notification not found or already read.",
    )
  }

  return { id: notificationId }
}
