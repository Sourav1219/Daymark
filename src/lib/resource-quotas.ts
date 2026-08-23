import "server-only"

import { and, count, eq, inArray, isNull, sql } from "drizzle-orm"

import type { DatabaseExecutor } from "@/db/client"
import {
  attachments,
  groupStudySessions,
  pushSubscriptions,
  reminders,
  tasks,
  timerSessions,
} from "@/db/schema"

export const resourceQuotas = {
  activeAttachmentsPerWorkspace: 1_000,
  activeAttachmentBytesPerWorkspace: 1_073_741_824,
  activeRemindersPerWorkspace: 1_000,
  activeRoomsPerWorkspace: 10,
  pushSubscriptionsPerUser: 10,
  retainedTasksPerWorkspace: 10_000,
  timerSessionsPerWorkspace: 50_000,
} as const

export class ResourceQuotaError extends Error {
  readonly code = "VALIDATION_ERROR" as const

  constructor(message: string) {
    super(message)
    this.name = "ResourceQuotaError"
  }
}

async function scalarCount(
  query: PromiseLike<readonly Readonly<{ value: number }>[]>,
) {
  const [result] = await query
  return Number(result?.value ?? 0)
}

export async function attachmentQuotaAvailable(
  database: DatabaseExecutor,
  workspaceId: string,
  requestedBytes: number,
) {
  const [usage] = await database
    .select({
      bytes: sql<number>`coalesce(sum(${attachments.expectedByteSize}), 0)`,
      items: count(),
    })
    .from(attachments)
    .where(
      and(
        eq(attachments.workspaceId, workspaceId),
        isNull(attachments.deletedAt),
        inArray(attachments.status, ["pending", "ready"]),
      ),
    )

  return (
    Number(usage?.items ?? 0) < resourceQuotas.activeAttachmentsPerWorkspace &&
    Number(usage?.bytes ?? 0) + requestedBytes <=
      resourceQuotas.activeAttachmentBytesPerWorkspace
  )
}

export function reminderQuotaAvailable(
  database: DatabaseExecutor,
  workspaceId: string,
) {
  return scalarCount(
    database
      .select({ value: count() })
      .from(reminders)
      .where(
        and(
          eq(reminders.workspaceId, workspaceId),
          isNull(reminders.deletedAt),
          inArray(reminders.status, ["pending", "processing", "retrying"]),
        ),
      ),
  ).then((value) => value < resourceQuotas.activeRemindersPerWorkspace)
}

export function taskQuotaAvailable(
  database: DatabaseExecutor,
  workspaceId: string,
) {
  return scalarCount(
    database
      .select({ value: count() })
      .from(tasks)
      .where(and(eq(tasks.workspaceId, workspaceId), isNull(tasks.purgedAt))),
  ).then((value) => value < resourceQuotas.retainedTasksPerWorkspace)
}

export function timerQuotaAvailable(
  database: DatabaseExecutor,
  workspaceId: string,
) {
  return scalarCount(
    database
      .select({ value: count() })
      .from(timerSessions)
      .where(eq(timerSessions.workspaceId, workspaceId)),
  ).then((value) => value < resourceQuotas.timerSessionsPerWorkspace)
}

export function roomQuotaAvailable(
  database: DatabaseExecutor,
  workspaceId: string,
) {
  return scalarCount(
    database
      .select({ value: count() })
      .from(groupStudySessions)
      .where(
        and(
          eq(groupStudySessions.workspaceId, workspaceId),
          eq(groupStudySessions.status, "active"),
        ),
      ),
  ).then((value) => value < resourceQuotas.activeRoomsPerWorkspace)
}

export function pushSubscriptionQuotaAvailable(
  database: DatabaseExecutor,
  userId: string,
) {
  return scalarCount(
    database
      .select({ value: count() })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId)),
  ).then((value) => value < resourceQuotas.pushSubscriptionsPerUser)
}
