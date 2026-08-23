import { sql } from "drizzle-orm"
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { users } from "./authentication"
import { tasks } from "./quests"
import { workspaces } from "./workspaces"
import type { LabelColorToken } from "@/features/labels/domain/types"

export const labels = pgTable(
  "labels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 60 }).notNull(),
    colorToken: varchar("color_token", { length: 32 })
      .$type<LabelColorToken>()
      .default("system-blue")
      .notNull(),
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
    check("labels_version_check", sql`${table.version} > 0`),
    unique("labels_id_workspace_unique").on(table.id, table.workspaceId),
    uniqueIndex("labels_workspace_name_unique")
      .on(sql`lower(${table.name})`, table.workspaceId)
      .where(sql`${table.deletedAt} is null`),
    index("labels_workspace_id_idx").on(table.workspaceId),
  ],
)

export const questLabels = pgTable(
  "quest_labels",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    questId: uuid("quest_id").notNull(),
    labelId: uuid("label_id").notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.questId, table.labelId] }),
    foreignKey({
      columns: [table.questId, table.workspaceId],
      foreignColumns: [tasks.id, tasks.workspaceId],
      name: "quest_labels_quest_workspace_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.labelId, table.workspaceId],
      foreignColumns: [labels.id, labels.workspaceId],
      name: "quest_labels_label_workspace_fk",
    }).onDelete("cascade"),
    index("quest_labels_workspace_label_idx").on(
      table.workspaceId,
      table.labelId,
    ),
    index("quest_labels_quest_idx").on(table.questId),
  ],
)
