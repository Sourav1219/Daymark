import { sql } from "drizzle-orm"
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { users } from "./authentication"
import { tasks } from "./quests"
import { workspaces } from "./workspaces"
import type {
  ReminderChannel,
  ReminderDeliveryStatus,
  ReminderStatus,
} from "@/features/reminders/domain/types"

export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    questId: uuid("quest_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    channel: varchar("channel", { length: 16 })
      .$type<ReminderChannel>()
      .notNull(),
    status: varchar("status", { length: 16 })
      .$type<ReminderStatus>()
      .default("pending")
      .notNull(),
    remindAt: timestamp("remind_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    timezone: varchar("timezone", { length: 64 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    processingStartedAt: timestamp("processing_started_at", {
      mode: "date",
      withTimezone: true,
    }),
    deliveredAt: timestamp("delivered_at", {
      mode: "date",
      withTimezone: true,
    }),
    lastErrorCode: varchar("last_error_code", { length: 64 }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    check(
      "reminders_channel_check",
      sql`${table.channel} in ('email', 'in_app')`,
    ),
    check(
      "reminders_status_check",
      sql`${table.status} in ('pending', 'processing', 'retrying', 'delivered', 'failed', 'cancelled')`,
    ),
    check("reminders_attempt_count_check", sql`${table.attemptCount} >= 0`),
    check(
      "reminders_max_attempts_check",
      sql`${table.maxAttempts} between 1 and 5`,
    ),
    check("reminders_version_check", sql`${table.version} > 0`),
    unique("reminders_id_workspace_unique").on(table.id, table.workspaceId),
    uniqueIndex("reminders_idempotency_key_unique").on(table.idempotencyKey),
    foreignKey({
      columns: [table.questId, table.workspaceId],
      foreignColumns: [tasks.id, tasks.workspaceId],
      name: "reminders_quest_workspace_fk",
    }).onDelete("restrict"),
    index("reminders_due_worker_idx")
      .on(table.status, table.nextAttemptAt)
      .where(sql`${table.deletedAt} is null`),
    index("reminders_workspace_quest_idx").on(table.workspaceId, table.questId),
    index("reminders_user_id_idx").on(table.userId),
  ],
)

export const reminderDeliveries = pgTable(
  "reminder_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    reminderId: uuid("reminder_id").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 200 }).notNull(),
    channel: varchar("channel", { length: 16 })
      .$type<ReminderChannel>()
      .notNull(),
    status: varchar("status", { length: 16 })
      .$type<ReminderDeliveryStatus>()
      .default("processing")
      .notNull(),
    attemptCount: integer("attempt_count").default(1).notNull(),
    providerMessageId: varchar("provider_message_id", { length: 160 }),
    errorCode: varchar("error_code", { length: 64 }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deliveredAt: timestamp("delivered_at", {
      mode: "date",
      withTimezone: true,
    }),
  },
  (table) => [
    check(
      "reminder_deliveries_channel_check",
      sql`${table.channel} in ('email', 'in_app')`,
    ),
    check(
      "reminder_deliveries_status_check",
      sql`${table.status} in ('processing', 'delivered', 'failed')`,
    ),
    check(
      "reminder_deliveries_attempt_count_check",
      sql`${table.attemptCount} > 0`,
    ),
    uniqueIndex("reminder_deliveries_idempotency_key_unique").on(
      table.idempotencyKey,
    ),
    foreignKey({
      columns: [table.reminderId, table.workspaceId],
      foreignColumns: [reminders.id, reminders.workspaceId],
      name: "reminder_deliveries_reminder_workspace_fk",
    }).onDelete("restrict"),
    index("reminder_deliveries_reminder_id_idx").on(table.reminderId),
  ],
)

export const inAppNotifications = pgTable(
  "in_app_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reminderId: uuid("reminder_id").notNull(),
    questId: uuid("quest_id").notNull(),
    kind: varchar("kind", { length: 40 })
      .default("quest_reminder_due")
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    readAt: timestamp("read_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    check(
      "in_app_notifications_kind_check",
      sql`${table.kind} = 'quest_reminder_due'`,
    ),
    uniqueIndex("in_app_notifications_reminder_unique").on(table.reminderId),
    foreignKey({
      columns: [table.reminderId, table.workspaceId],
      foreignColumns: [reminders.id, reminders.workspaceId],
      name: "in_app_notifications_reminder_workspace_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.questId, table.workspaceId],
      foreignColumns: [tasks.id, tasks.workspaceId],
      name: "in_app_notifications_quest_workspace_fk",
    }).onDelete("restrict"),
    index("in_app_notifications_user_unread_idx")
      .on(table.userId, table.readAt)
      .where(sql`${table.readAt} is null`),
    // The inbox read filters on workspace + user and orders by recency, which
    // the unread-only index above cannot serve.
    index("in_app_notifications_workspace_user_created_idx").on(
      table.workspaceId,
      table.userId,
      table.createdAt,
    ),
  ],
)

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: varchar("endpoint", { length: 2_048 }).notNull(),
    p256dh: varchar("p256dh", { length: 256 }).notNull(),
    auth: varchar("auth", { length: 128 }).notNull(),
    expirationTime: timestamp("expiration_time", {
      mode: "date",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    consecutiveFailureCount: integer("consecutive_failure_count")
      .default(0)
      .notNull(),
    lastFailureAt: timestamp("last_failure_at", {
      mode: "date",
      withTimezone: true,
    }),
  },
  (table) => [
    check(
      "push_subscriptions_failure_count_check",
      sql`${table.consecutiveFailureCount} >= 0`,
    ),
    uniqueIndex("push_subscriptions_endpoint_unique").on(table.endpoint),
    index("push_subscriptions_user_idx").on(table.userId),
  ],
)
