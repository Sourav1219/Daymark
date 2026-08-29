import { sql } from "drizzle-orm"
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { users } from "./authentication"
import { gates } from "./gates"
import { workspaces } from "./workspaces"
import type { QuestPriority, QuestStatus } from "@/features/quests/domain/types"

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    projectId: uuid("project_id"),
    parentTaskId: uuid("parent_task_id"),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description").default("").notNull(),
    status: varchar("status", { length: 16 })
      .$type<QuestStatus>()
      .default("open")
      .notNull(),
    priority: varchar("priority", { length: 16 })
      .$type<QuestPriority>()
      .default("medium")
      .notNull(),
    position: integer("position").default(0).notNull(),
    startAt: timestamp("start_at", { mode: "date", withTimezone: true }),
    dueAt: timestamp("due_at", { mode: "date", withTimezone: true }),
    recurrenceRule: text("recurrence_rule"),
    recurrenceTimezone: varchar("recurrence_timezone", { length: 64 }),
    recurrenceSeriesId: uuid("recurrence_series_id"),
    recurrenceOccurrenceAt: timestamp("recurrence_occurrence_at", {
      mode: "date",
      withTimezone: true,
    }),
    recurrenceSequence: integer("recurrence_sequence"),
    offlineMutationId: uuid("offline_mutation_id"),
    xpReward: integer("xp_reward").default(0).notNull(),
    completedAt: timestamp("completed_at", {
      mode: "date",
      withTimezone: true,
    }),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
    purgedAt: timestamp("purged_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    check(
      "tasks_status_check",
      sql`${table.status} in ('open', 'completed', 'failed')`,
    ),
    check(
      "tasks_priority_check",
      sql`${table.priority} in ('low', 'medium', 'high', 'critical')`,
    ),
    check("tasks_position_check", sql`${table.position} >= 0`),
    check(
      "tasks_recurrence_fields_check",
      sql`(${table.recurrenceRule} is null and ${table.recurrenceTimezone} is null and ${table.recurrenceSeriesId} is null and ${table.recurrenceOccurrenceAt} is null and ${table.recurrenceSequence} is null) or (${table.recurrenceRule} is not null and ${table.recurrenceTimezone} is not null and ${table.recurrenceSeriesId} is not null and ${table.recurrenceOccurrenceAt} is not null and ${table.recurrenceSequence} >= 0)`,
    ),
    check("tasks_xp_reward_check", sql`${table.xpReward} >= 0`),
    check("tasks_version_check", sql`${table.version} > 0`),
    unique("tasks_id_workspace_unique").on(table.id, table.workspaceId),
    foreignKey({
      columns: [table.projectId, table.workspaceId],
      foreignColumns: [gates.id, gates.workspaceId],
      name: "tasks_project_workspace_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.parentTaskId, table.workspaceId],
      foreignColumns: [table.id, table.workspaceId],
      name: "tasks_parent_workspace_fk",
    }).onDelete("restrict"),
    index("tasks_workspace_status_idx")
      .on(table.workspaceId, table.status)
      .where(sql`${table.deletedAt} is null`),
    index("tasks_workspace_due_at_idx")
      .on(table.workspaceId, table.dueAt)
      .where(sql`${table.deletedAt} is null`),
    index("tasks_workspace_position_idx")
      .on(table.workspaceId, table.position)
      .where(sql`${table.deletedAt} is null`),
    index("tasks_workspace_deleted_at_idx").on(
      table.workspaceId,
      table.deletedAt,
    ),
    index("tasks_workspace_purged_at_idx").on(
      table.workspaceId,
      table.purgedAt,
    ),
    index("tasks_project_id_idx")
      .on(table.projectId)
      .where(sql`${table.projectId} is not null`),
    index("tasks_parent_task_id_idx")
      .on(table.parentTaskId)
      .where(sql`${table.parentTaskId} is not null`),
    // Composite, deletion-aware indexes for the list and aggregate reads.
    // The single-column indexes above still serve foreign-key lookups, but
    // every workspace-scoped read also filters deletedAt, so without these the
    // planner either scans or filters after an index scan.
    index("tasks_workspace_updated_at_idx")
      .on(table.workspaceId, table.updatedAt)
      .where(sql`${table.deletedAt} is null`),
    index("tasks_workspace_priority_sort_idx")
      .on(
        table.workspaceId,
        sql`(case ${table.priority} when 'critical' then 0 when 'high' then 1 when 'medium' then 2 else 3 end)`,
        table.dueAt,
        table.updatedAt,
      )
      .where(sql`${table.deletedAt} is null`),
    index("tasks_workspace_project_idx")
      .on(table.workspaceId, table.projectId)
      .where(
        sql`${table.projectId} is not null and ${table.deletedAt} is null`,
      ),
    index("tasks_workspace_parent_task_idx")
      .on(table.workspaceId, table.parentTaskId)
      .where(
        sql`${table.parentTaskId} is not null and ${table.deletedAt} is null`,
      ),
    uniqueIndex("tasks_recurrence_occurrence_unique")
      .on(table.recurrenceSeriesId, table.recurrenceOccurrenceAt)
      .where(sql`${table.recurrenceSeriesId} is not null`),
    index("tasks_recurrence_series_idx")
      .on(table.workspaceId, table.recurrenceSeriesId)
      .where(sql`${table.recurrenceSeriesId} is not null`),
    uniqueIndex("tasks_workspace_offline_mutation_unique")
      .on(table.workspaceId, table.offlineMutationId)
      .where(sql`${table.offlineMutationId} is not null`),
    index("tasks_title_search_idx")
      .using("gin", table.title.op("gin_trgm_ops"))
      .where(sql`${table.deletedAt} is null`),
    index("tasks_description_search_idx")
      .using("gin", table.description.op("gin_trgm_ops"))
      .where(sql`${table.deletedAt} is null`),
  ],
)
