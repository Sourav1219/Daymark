import { sql } from "drizzle-orm"
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
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
  QuestActivityEventType,
  QuestActivityPayload,
} from "@/features/activity-events/domain/types"
import type { HunterRank } from "@/features/progression/domain/progression"

export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    eventType: varchar("event_type", { length: 32 })
      .$type<QuestActivityEventType>()
      .notNull(),
    subjectType: varchar("subject_type", { length: 24 })
      .default("quest")
      .notNull(),
    subjectId: uuid("subject_id").notNull(),
    payload: jsonb("payload").$type<QuestActivityPayload>().notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 220 }).notNull(),
    occurredAt: timestamp("occurred_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "activity_events_event_type_check",
      sql`${table.eventType} in ('quest_completed', 'quest_reopened', 'quest_deleted', 'quest_restored', 'quest_failed')`,
    ),
    check(
      "activity_events_subject_type_check",
      sql`${table.subjectType} = 'quest'`,
    ),
    unique("activity_events_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    uniqueIndex("activity_events_workspace_idempotency_unique").on(
      table.workspaceId,
      table.idempotencyKey,
    ),
    index("activity_events_workspace_occurred_idx").on(
      table.workspaceId,
      table.occurredAt,
    ),
    index("activity_events_workspace_subject_idx").on(
      table.workspaceId,
      table.subjectType,
      table.subjectId,
    ),
  ],
)

export const xpLedgerReasons = [
  "quest_completion",
  "quest_reopen_reversal",
  "quest_delete_reversal",
  "quest_restore",
  "quest_failure_penalty",
] as const
export type XpLedgerReason = (typeof xpLedgerReasons)[number]

export const xpLedger = pgTable(
  "xp_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    activityEventId: uuid("activity_event_id").notNull(),
    questId: uuid("quest_id").notNull(),
    xpDelta: integer("xp_delta").notNull(),
    reason: varchar("reason", { length: 32 }).$type<XpLedgerReason>().notNull(),
    earnedForLocalDate: date("earned_for_local_date", {
      mode: "string",
    }).notNull(),
    reversesLedgerEntryId: uuid("reverses_ledger_entry_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Escalating miss penalties can exceed a single task's 50 XP ceiling, so
    // the negative side is widened to the maximumFailurePenalty bound.
    check(
      "xp_ledger_delta_check",
      sql`${table.xpDelta} between -500 and 50 and ${table.xpDelta} <> 0`,
    ),
    check(
      "xp_ledger_reason_check",
      sql`${table.reason} in ('quest_completion', 'quest_reopen_reversal', 'quest_delete_reversal', 'quest_restore', 'quest_failure_penalty')`,
    ),
    unique("xp_ledger_id_workspace_unique").on(table.id, table.workspaceId),
    uniqueIndex("xp_ledger_activity_event_unique").on(table.activityEventId),
    uniqueIndex("xp_ledger_reversal_unique")
      .on(table.reversesLedgerEntryId)
      .where(sql`${table.reversesLedgerEntryId} is not null`),
    foreignKey({
      columns: [table.activityEventId, table.workspaceId],
      foreignColumns: [activityEvents.id, activityEvents.workspaceId],
      name: "xp_ledger_activity_event_workspace_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.questId, table.workspaceId],
      foreignColumns: [tasks.id, tasks.workspaceId],
      name: "xp_ledger_quest_workspace_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.reversesLedgerEntryId, table.workspaceId],
      foreignColumns: [table.id, table.workspaceId],
      name: "xp_ledger_reversal_workspace_fk",
    }).onDelete("restrict"),
    index("xp_ledger_user_date_idx").on(
      table.workspaceId,
      table.userId,
      table.earnedForLocalDate,
    ),
    index("xp_ledger_quest_idx").on(table.workspaceId, table.questId),
  ],
)

export const userProgression = pgTable(
  "user_progression",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    experiencePoints: integer("experience_points").default(0).notNull(),
    hunterLevel: integer("hunter_level").default(1).notNull(),
    hunterRank: varchar("hunter_rank", { length: 1 })
      .$type<HunterRank>()
      .default("E")
      .notNull(),
    currentStreak: integer("current_streak").default(0).notNull(),
    bestStreak: integer("best_streak").default(0).notNull(),
    lastClearedLocalDate: date("last_cleared_local_date", { mode: "string" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    check(
      "user_progression_xp_check",
      sql`${table.experiencePoints} between 0 and 2000000000`,
    ),
    check(
      "user_progression_rank_check",
      sql`${table.hunterRank} in ('E', 'D', 'C', 'B', 'A', 'S')`,
    ),
    check(
      "user_progression_level_check",
      sql`${table.hunterLevel} between 1 and 6`,
    ),
    check(
      "user_progression_streak_check",
      sql`${table.currentStreak} >= 0 and ${table.bestStreak} >= ${table.currentStreak}`,
    ),
    check("user_progression_version_check", sql`${table.version} > 0`),
    uniqueIndex("user_progression_workspace_user_unique").on(
      table.workspaceId,
      table.userId,
    ),
    index("user_progression_user_idx").on(table.userId),
  ],
)
