import { sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { users } from "./authentication"
import { timerSessions } from "./timer"
import { workspaces } from "./workspaces"
import type {
  GroupStudyActivityAction,
  GroupStudySessionStatus,
} from "@/features/timer/domain/types"

export const groupStudySessions = pgTable(
  "group_study_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    hostUserId: uuid("host_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    joinCode: varchar("join_code", { length: 8 }).notNull(),
    joinLocked: boolean("join_locked").default(false).notNull(),
    name: varchar("name", { length: 80 }).default("Focus room").notNull(),
    participantLimit: integer("participant_limit").default(8).notNull(),
    subject: varchar("subject", { length: 160 }).notNull(),
    status: varchar("status", { length: 16 })
      .$type<GroupStudySessionStatus>()
      .default("active")
      .notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }),
    endedAt: timestamp("ended_at", { mode: "date", withTimezone: true }),
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
      "group_study_sessions_status_check",
      sql`${table.status} in ('active', 'closed')`,
    ),
    check("group_study_sessions_version_check", sql`${table.version} > 0`),
    check(
      "group_study_sessions_participant_limit_check",
      sql`${table.participantLimit} between 2 and 20`,
    ),
    check(
      "group_study_sessions_lifecycle_check",
      sql`(${table.status} = 'active' and ${table.endedAt} is null) or (${table.status} = 'closed' and ${table.endedAt} is not null)`,
    ),
    uniqueIndex("group_study_sessions_join_code_unique").on(table.joinCode),
    index("group_study_sessions_host_created_idx").on(
      table.workspaceId,
      table.hostUserId,
      table.createdAt,
    ),
    index("group_study_sessions_ended_idx").on(
      table.workspaceId,
      table.hostUserId,
      table.endedAt,
    ),
    index("group_study_sessions_workspace_status_idx").on(
      table.workspaceId,
      table.status,
    ),
  ],
)

export const groupStudyBlocks = pgTable(
  "group_study_blocks",
  {
    blockedAt: timestamp("blocked_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    blockedByUserId: uuid("blocked_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    groupSessionId: uuid("group_session_id")
      .notNull()
      .references(() => groupStudySessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.groupSessionId, table.userId] }),
    index("group_study_blocks_user_idx").on(table.userId),
  ],
)

export const groupStudyParticipants = pgTable(
  "group_study_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupSessionId: uuid("group_session_id")
      .notNull()
      .references(() => groupStudySessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    timerSessionId: uuid("timer_session_id")
      .notNull()
      .references(() => timerSessions.id, { onDelete: "restrict" }),
    joinedAt: timestamp("joined_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    leftAt: timestamp("left_at", { mode: "date", withTimezone: true }),
    lastHeartbeatAt: timestamp("last_heartbeat_at", {
      mode: "date",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    check("group_study_participants_version_check", sql`${table.version} > 0`),
    uniqueIndex("group_study_participants_timer_unique").on(
      table.timerSessionId,
    ),
    uniqueIndex("group_study_participants_user_active_unique")
      .on(table.userId)
      .where(sql`${table.leftAt} is null`),
    index("group_study_participants_session_active_idx").on(
      table.groupSessionId,
      table.leftAt,
    ),
    index("group_study_participants_user_left_idx").on(
      table.userId,
      table.leftAt,
    ),
    index("group_study_participants_heartbeat_idx").on(table.lastHeartbeatAt),
  ],
)

export const groupStudyActivities = pgTable(
  "group_study_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupSessionId: uuid("group_session_id")
      .notNull()
      .references(() => groupStudySessions.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => groupStudyParticipants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 16 })
      .$type<GroupStudyActivityAction>()
      .notNull(),
    timerElapsedMs: bigint("timer_elapsed_ms", { mode: "number" })
      .default(0)
      .notNull(),
    occurredAt: timestamp("occurred_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "group_study_activities_action_check",
      sql`${table.action} in ('joined', 'paused', 'resumed', 'left', 'removed', 'blocked')`,
    ),
    check(
      "group_study_activities_elapsed_check",
      sql`${table.timerElapsedMs} >= 0`,
    ),
    index("group_study_activities_session_time_idx").on(
      table.groupSessionId,
      table.occurredAt,
    ),
  ],
)

export const groupStudyJoinRequests = pgTable(
  "group_study_join_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupSessionId: uuid("group_session_id")
      .notNull()
      .references(() => groupStudySessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 16 })
      .$type<"pending" | "approved" | "rejected">()
      .default("pending")
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "group_study_join_requests_status_check",
      sql`${table.status} in ('pending', 'approved', 'rejected')`,
    ),
    index("group_study_join_requests_session_idx").on(table.groupSessionId),
    index("group_study_join_requests_user_idx").on(table.userId),
    uniqueIndex("group_study_join_requests_active_unique")
      .on(table.groupSessionId, table.userId)
      .where(sql`${table.status} = 'pending'`),
  ],
)
