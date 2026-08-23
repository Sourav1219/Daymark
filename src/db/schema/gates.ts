import { sql } from "drizzle-orm"
import {
  check,
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
import { workspaces } from "./workspaces"
import type { GateAccentToken } from "@/features/gates/domain/types"

export const gates = pgTable(
  "gates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description").default("").notNull(),
    accentToken: varchar("accent_token", { length: 32 })
      .$type<GateAccentToken>()
      .default("system-blue")
      .notNull(),
    position: integer("position").default(0).notNull(),
    archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
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
    check("gates_position_check", sql`${table.position} >= 0`),
    check("gates_version_check", sql`${table.version} > 0`),
    unique("gates_id_workspace_unique").on(table.id, table.workspaceId),
    uniqueIndex("gates_workspace_name_unique")
      .on(sql`lower(${table.name})`, table.workspaceId)
      .where(sql`${table.deletedAt} is null`),
    index("gates_workspace_lifecycle_idx").on(
      table.workspaceId,
      table.archivedAt,
      table.deletedAt,
      table.position,
    ),
    index("gates_creator_idx").on(table.createdByUserId),
  ],
)
