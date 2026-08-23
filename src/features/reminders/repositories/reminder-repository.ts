import "server-only"

import { randomUUID } from "node:crypto"

import {
  and,
  asc,
  desc,
  eq,
  exists,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm"

import type { DatabaseExecutor } from "@/db/client"
import {
  inAppNotifications,
  reminderDeliveries,
  reminders,
  tasks,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import type {
  DueSoonQuestView,
  NotificationView,
  ReminderChannel,
  ReminderStatus,
  ReminderView,
} from "@/features/reminders/domain/types"

export type ReminderRecord = Readonly<{
  attemptCount: number
  channel: ReminderChannel
  id: string
  maxAttempts: number
  nextAttemptAt: Date
  questId: string
  remindAt: Date
  status: ReminderStatus
  timezone: string
  userId: string
  version: number
  workspaceId: string
}>

export type ClaimedReminder = ReminderRecord &
  Readonly<{
    idempotencyKey: string
    recipientEmail: string
  }>

const reminderSelection = {
  attemptCount: reminders.attemptCount,
  channel: reminders.channel,
  id: reminders.id,
  maxAttempts: reminders.maxAttempts,
  nextAttemptAt: reminders.nextAttemptAt,
  questId: reminders.questId,
  remindAt: reminders.remindAt,
  status: reminders.status,
  timezone: reminders.timezone,
  userId: reminders.userId,
  version: reminders.version,
  workspaceId: reminders.workspaceId,
}

function activeAccessPredicate(
  database: DatabaseExecutor,
  access: AccessContext,
) {
  return exists(
    database
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(
        and(
          eq(workspaceMembers.userId, access.userId),
          eq(workspaceMembers.workspaceId, access.workspaceId),
          isNull(workspaceMembers.deletedAt),
          isNull(workspaces.deletedAt),
        ),
      ),
  )
}

export async function createReminderRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  input: Readonly<{
    channel: ReminderChannel
    questId: string
    remindAt: Date
    timezone: string
  }>,
): Promise<ReminderRecord | null> {
  const id = randomUUID()
  const [quest] = await database
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.id, input.questId),
        eq(tasks.workspaceId, access.workspaceId),
        eq(tasks.status, "open"),
        isNull(tasks.deletedAt),
        activeAccessPredicate(database, access),
      ),
    )
    .limit(1)

  if (!quest) return null

  const [created] = await database
    .insert(reminders)
    .values({
      channel: input.channel,
      id,
      idempotencyKey: `quest-reminder/${id}`,
      nextAttemptAt: input.remindAt,
      questId: quest.id,
      remindAt: input.remindAt,
      timezone: input.timezone,
      userId: access.userId,
      workspaceId: access.workspaceId,
    })
    .returning(reminderSelection)

  return created ?? null
}

export async function findReminderRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  reminderId: string,
): Promise<ReminderRecord | null> {
  const [record] = await database
    .select(reminderSelection)
    .from(reminders)
    .where(
      and(
        eq(reminders.id, reminderId),
        eq(reminders.workspaceId, access.workspaceId),
        eq(reminders.userId, access.userId),
        isNull(reminders.deletedAt),
        activeAccessPredicate(database, access),
      ),
    )
    .limit(1)

  return record ?? null
}

export async function updateReminderRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  input: Readonly<{
    channel: ReminderChannel
    expectedVersion: number
    questId: string
    remindAt: Date
    reminderId: string
    timezone: string
  }>,
): Promise<ReminderRecord | null> {
  const questIsActive = exists(
    database
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.id, input.questId),
          eq(tasks.workspaceId, access.workspaceId),
          eq(tasks.status, "open"),
          isNull(tasks.deletedAt),
        ),
      ),
  )
  const [updated] = await database
    .update(reminders)
    .set({
      attemptCount: 0,
      channel: input.channel,
      lastErrorCode: null,
      nextAttemptAt: input.remindAt,
      processingStartedAt: null,
      questId: input.questId,
      remindAt: input.remindAt,
      status: "pending",
      timezone: input.timezone,
      updatedAt: new Date(),
      version: sql`${reminders.version} + 1`,
    })
    .where(
      and(
        eq(reminders.id, input.reminderId),
        eq(reminders.workspaceId, access.workspaceId),
        eq(reminders.userId, access.userId),
        eq(reminders.version, input.expectedVersion),
        inArray(reminders.status, ["pending", "retrying"]),
        isNull(reminders.deletedAt),
        questIsActive,
        activeAccessPredicate(database, access),
      ),
    )
    .returning(reminderSelection)

  return updated ?? null
}

export async function cancelReminderRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  input: Readonly<{ expectedVersion: number; reminderId: string }>,
): Promise<ReminderRecord | null> {
  const [cancelled] = await database
    .update(reminders)
    .set({
      nextAttemptAt: new Date(),
      processingStartedAt: null,
      status: "cancelled",
      updatedAt: new Date(),
      version: sql`${reminders.version} + 1`,
    })
    .where(
      and(
        eq(reminders.id, input.reminderId),
        eq(reminders.workspaceId, access.workspaceId),
        eq(reminders.userId, access.userId),
        eq(reminders.version, input.expectedVersion),
        inArray(reminders.status, ["pending", "retrying"]),
        isNull(reminders.deletedAt),
        activeAccessPredicate(database, access),
      ),
    )
    .returning(reminderSelection)

  return cancelled ?? null
}

export async function listReminderViews(
  database: DatabaseExecutor,
  access: AccessContext,
  limit = 100,
): Promise<readonly ReminderView[]> {
  const rows = await database
    .select({
      attemptCount: reminders.attemptCount,
      channel: reminders.channel,
      id: reminders.id,
      questId: reminders.questId,
      questTitle: tasks.title,
      remindAt: reminders.remindAt,
      status: reminders.status,
      timezone: reminders.timezone,
      version: reminders.version,
    })
    .from(reminders)
    .innerJoin(
      tasks,
      and(
        eq(tasks.id, reminders.questId),
        eq(tasks.workspaceId, reminders.workspaceId),
      ),
    )
    .where(
      and(
        eq(reminders.workspaceId, access.workspaceId),
        eq(reminders.userId, access.userId),
        isNull(reminders.deletedAt),
        activeAccessPredicate(database, access),
      ),
    )
    .orderBy(asc(reminders.remindAt), desc(reminders.updatedAt))
    .limit(limit)

  return rows.map((row) => ({
    ...row,
    remindAt: row.remindAt.toISOString(),
  }))
}

export async function listNotificationViews(
  database: DatabaseExecutor,
  access: AccessContext,
  limit = 20,
): Promise<readonly NotificationView[]> {
  const rows = await database
    .select({
      createdAt: inAppNotifications.createdAt,
      dueAt: tasks.dueAt,
      id: inAppNotifications.id,
      questId: inAppNotifications.questId,
      questTitle: tasks.title,
      readAt: inAppNotifications.readAt,
    })
    .from(inAppNotifications)
    .innerJoin(
      tasks,
      and(
        eq(tasks.id, inAppNotifications.questId),
        eq(tasks.workspaceId, inAppNotifications.workspaceId),
      ),
    )
    .where(
      and(
        eq(inAppNotifications.workspaceId, access.workspaceId),
        eq(inAppNotifications.userId, access.userId),
        activeAccessPredicate(database, access),
      ),
    )
    .orderBy(desc(inAppNotifications.createdAt))
    .limit(limit)

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    dueAt: row.dueAt?.toISOString() ?? null,
    readAt: row.readAt?.toISOString() ?? null,
  }))
}

export async function listDueSoonQuestViews(
  database: DatabaseExecutor,
  access: AccessContext,
  options: Readonly<{ limit?: number; now: Date; until: Date }>,
): Promise<readonly DueSoonQuestView[]> {
  const rows = await database
    .select({ dueAt: tasks.dueAt, id: tasks.id, title: tasks.title })
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceId, access.workspaceId),
        eq(tasks.status, "open"),
        isNull(tasks.deletedAt),
        isNotNull(tasks.dueAt),
        gt(tasks.dueAt, options.now),
        lt(tasks.dueAt, options.until),
        activeAccessPredicate(database, access),
      ),
    )
    .orderBy(asc(tasks.dueAt))
    .limit(Math.min(Math.max(options.limit ?? 20, 1), 50))

  return rows.flatMap((row) =>
    row.dueAt
      ? [{ dueAt: row.dueAt.toISOString(), id: row.id, title: row.title }]
      : [],
  )
}

export async function markNotificationReadRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  notificationId: string,
): Promise<boolean> {
  const [updated] = await database
    .update(inAppNotifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(inAppNotifications.id, notificationId),
        eq(inAppNotifications.workspaceId, access.workspaceId),
        eq(inAppNotifications.userId, access.userId),
        isNull(inAppNotifications.readAt),
        activeAccessPredicate(database, access),
      ),
    )
    .returning({ id: inAppNotifications.id })

  return Boolean(updated)
}

export async function clonePendingRemindersForOccurrence(
  database: DatabaseExecutor,
  access: AccessContext,
  input: Readonly<{
    completedAt: Date
    currentOccurrenceAt: Date
    currentQuestId: string
    nextOccurrenceAt: Date
    nextQuestId: string
  }>,
): Promise<number> {
  const current = await database
    .select({
      channel: reminders.channel,
      remindAt: reminders.remindAt,
      timezone: reminders.timezone,
      userId: reminders.userId,
    })
    .from(reminders)
    .where(
      and(
        eq(reminders.workspaceId, access.workspaceId),
        eq(reminders.questId, input.currentQuestId),
        inArray(reminders.status, ["pending", "retrying"]),
        isNull(reminders.deletedAt),
      ),
    )

  let cloned = 0

  for (const reminder of current) {
    const leadTime =
      input.currentOccurrenceAt.getTime() - reminder.remindAt.getTime()
    const remindAt = new Date(input.nextOccurrenceAt.getTime() - leadTime)

    if (remindAt <= input.completedAt) continue

    const id = randomUUID()
    await database.insert(reminders).values({
      channel: reminder.channel,
      id,
      idempotencyKey: `quest-reminder/${id}`,
      nextAttemptAt: remindAt,
      questId: input.nextQuestId,
      remindAt,
      timezone: reminder.timezone,
      userId: reminder.userId,
      workspaceId: access.workspaceId,
    })
    cloned += 1
  }

  return cloned
}

export async function cancelInaccessibleReminders(
  database: DatabaseExecutor,
  now: Date,
): Promise<number> {
  const result = await database.execute(sql`
    update ${reminders} as reminder
    set status = 'cancelled', updated_at = ${now.toISOString()}::timestamptz, version = version + 1
    where reminder.deleted_at is null
      and reminder.status in ('pending', 'retrying', 'processing')
      and not exists (
        select 1
        from ${workspaceMembers} as member
        join ${workspaces} as workspace on workspace.id = member.workspace_id
        join ${tasks} as task
          on task.id = reminder.quest_id
          and task.workspace_id = reminder.workspace_id
        where member.user_id = reminder.user_id
          and member.workspace_id = reminder.workspace_id
          and member.deleted_at is null
          and workspace.deleted_at is null
          and task.deleted_at is null
          and task.status = 'open'
      )
    returning reminder.id
  `)

  return result.length
}

export async function countDueReminderRecords(
  database: DatabaseExecutor,
  now: Date,
): Promise<number> {
  const leaseExpiredAt = new Date(now.getTime() - 10 * 60_000)
  const rows = await database
    .select({ id: reminders.id })
    .from(reminders)
    .innerJoin(
      tasks,
      and(
        eq(tasks.id, reminders.questId),
        eq(tasks.workspaceId, reminders.workspaceId),
      ),
    )
    .innerJoin(
      workspaceMembers,
      and(
        eq(workspaceMembers.userId, reminders.userId),
        eq(workspaceMembers.workspaceId, reminders.workspaceId),
      ),
    )
    .innerJoin(workspaces, eq(workspaces.id, reminders.workspaceId))
    .where(
      and(
        isNull(reminders.deletedAt),
        isNull(tasks.deletedAt),
        eq(tasks.status, "open"),
        isNull(workspaceMembers.deletedAt),
        isNull(workspaces.deletedAt),
        lte(reminders.nextAttemptAt, now),
        sql`${reminders.attemptCount} < ${reminders.maxAttempts}`,
        or(
          inArray(reminders.status, ["pending", "retrying"]),
          and(
            eq(reminders.status, "processing"),
            lte(reminders.processingStartedAt, leaseExpiredAt),
          ),
        ),
      ),
    )
    .limit(1_000)

  return rows.length
}

export async function claimDueReminderRecords(
  database: DatabaseExecutor,
  now: Date,
  limit: number,
): Promise<readonly ClaimedReminder[]> {
  const leaseExpiredAt = new Date(now.getTime() - 10 * 60_000)
  const dueIds = database
    .select({ id: reminders.id })
    .from(reminders)
    .innerJoin(
      tasks,
      and(
        eq(tasks.id, reminders.questId),
        eq(tasks.workspaceId, reminders.workspaceId),
      ),
    )
    .innerJoin(
      workspaceMembers,
      and(
        eq(workspaceMembers.userId, reminders.userId),
        eq(workspaceMembers.workspaceId, reminders.workspaceId),
      ),
    )
    .innerJoin(workspaces, eq(workspaces.id, reminders.workspaceId))
    .where(
      and(
        isNull(reminders.deletedAt),
        isNull(tasks.deletedAt),
        eq(tasks.status, "open"),
        isNull(workspaceMembers.deletedAt),
        isNull(workspaces.deletedAt),
        lte(reminders.nextAttemptAt, now),
        sql`${reminders.attemptCount} < ${reminders.maxAttempts}`,
        or(
          inArray(reminders.status, ["pending", "retrying"]),
          and(
            eq(reminders.status, "processing"),
            lte(reminders.processingStartedAt, leaseExpiredAt),
          ),
        ),
      ),
    )
    .orderBy(asc(reminders.nextAttemptAt))
    .for("update", { skipLocked: true })
    .limit(limit)

  const rows = await database
    .update(reminders)
    .set({
      attemptCount: sql`${reminders.attemptCount} + 1`,
      processingStartedAt: now,
      status: "processing",
      updatedAt: now,
    })
    .where(inArray(reminders.id, dueIds))
    .returning({
      ...reminderSelection,
      idempotencyKey: reminders.idempotencyKey,
    })

  if (rows.length === 0) return []

  const recipients = await database
    .select({
      email: users.email,
      reminderId: reminders.id,
    })
    .from(reminders)
    .innerJoin(users, eq(users.id, reminders.userId))
    .where(
      inArray(
        reminders.id,
        rows.map((row) => row.id),
      ),
    )
  const emailByReminder = new Map(
    recipients.map((recipient) => [recipient.reminderId, recipient.email]),
  )

  return rows.flatMap((row) => {
    const recipientEmail = emailByReminder.get(row.id)
    return recipientEmail ? [{ ...row, recipientEmail }] : []
  })
}

export async function beginReminderDeliveryRecord(
  database: DatabaseExecutor,
  reminder: ClaimedReminder,
) {
  const [delivery] = await database
    .insert(reminderDeliveries)
    .values({
      attemptCount: reminder.attemptCount,
      channel: reminder.channel,
      idempotencyKey: reminder.idempotencyKey,
      reminderId: reminder.id,
      status: "processing",
      workspaceId: reminder.workspaceId,
    })
    .onConflictDoUpdate({
      target: reminderDeliveries.idempotencyKey,
      set: {
        attemptCount: reminder.attemptCount,
        status: sql`case when ${reminderDeliveries.status} = 'delivered' then 'delivered' else 'processing' end`,
        updatedAt: new Date(),
      },
    })
    .returning()

  return delivery
}

export async function completeReminderDeliveryRecord(
  database: DatabaseExecutor,
  reminder: ClaimedReminder,
  providerMessageId: string | null,
  deliveredAt: Date,
): Promise<void> {
  await database
    .update(reminderDeliveries)
    .set({
      deliveredAt,
      errorCode: null,
      providerMessageId,
      status: "delivered",
      updatedAt: deliveredAt,
    })
    .where(eq(reminderDeliveries.idempotencyKey, reminder.idempotencyKey))

  await database
    .insert(inAppNotifications)
    .values({
      questId: reminder.questId,
      reminderId: reminder.id,
      userId: reminder.userId,
      workspaceId: reminder.workspaceId,
    })
    .onConflictDoNothing()

  await database
    .update(reminders)
    .set({
      deliveredAt,
      lastErrorCode: null,
      processingStartedAt: null,
      status: "delivered",
      updatedAt: deliveredAt,
      version: sql`${reminders.version} + 1`,
    })
    .where(
      and(eq(reminders.id, reminder.id), eq(reminders.status, "processing")),
    )
}

export async function failReminderDeliveryRecord(
  database: DatabaseExecutor,
  reminder: ClaimedReminder,
  errorCode: string,
  nextAttemptAt: Date,
  failedAt: Date,
): Promise<"failed" | "retrying"> {
  const terminal = reminder.attemptCount >= reminder.maxAttempts
  const status = terminal ? "failed" : "retrying"

  await database
    .update(reminderDeliveries)
    .set({ errorCode, status: "failed", updatedAt: failedAt })
    .where(eq(reminderDeliveries.idempotencyKey, reminder.idempotencyKey))

  await database
    .update(reminders)
    .set({
      lastErrorCode: errorCode,
      nextAttemptAt,
      processingStartedAt: null,
      status,
      updatedAt: failedAt,
      version: sql`${reminders.version} + 1`,
    })
    .where(
      and(eq(reminders.id, reminder.id), eq(reminders.status, "processing")),
    )

  return status
}
