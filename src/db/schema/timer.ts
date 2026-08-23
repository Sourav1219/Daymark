import { sql } from "drizzle-orm"
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { users } from "./authentication"
import { workspaces } from "./workspaces"
import type { TimerSessionStatus } from "@/features/timer/domain/types"

export const timerSessions = pgTable(
  "timer_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subject: varchar("subject", { length: 160 }).notNull(),
    status: varchar("status", { length: 16 })
      .$type<TimerSessionStatus>()
      .default("running")
      .notNull(),
    accumulatedMs: bigint("accumulated_ms", { mode: "number" })
      .default(0)
      .notNull(),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    lastStartedAt: timestamp("last_started_at", {
      mode: "date",
      withTimezone: true,
    }).defaultNow(),
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
      "timer_sessions_status_check",
      sql`${table.status} in ('running', 'paused', 'completed')`,
    ),
    check(
      "timer_sessions_accumulated_ms_check",
      sql`${table.accumulatedMs} >= 0`,
    ),
    check("timer_sessions_version_check", sql`${table.version} > 0`),
    check(
      "timer_sessions_lifecycle_check",
      sql`(${table.status} = 'running' and ${table.lastStartedAt} is not null and ${table.endedAt} is null) or (${table.status} = 'paused' and ${table.lastStartedAt} is null and ${table.endedAt} is null) or (${table.status} = 'completed' and ${table.lastStartedAt} is null and ${table.endedAt} is not null)`,
    ),
    uniqueIndex("timer_sessions_user_active_unique")
      .on(table.workspaceId, table.userId)
      .where(sql`${table.status} in ('running', 'paused')`),
    index("timer_sessions_user_started_idx").on(
      table.workspaceId,
      table.userId,
      table.startedAt,
    ),
    index("timer_sessions_user_ended_idx").on(
      table.workspaceId,
      table.userId,
      table.endedAt,
    ),
  ],
)
