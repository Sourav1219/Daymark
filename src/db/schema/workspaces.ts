import { sql } from "drizzle-orm"
import {
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
import type { WorkspaceRole } from "@/features/workspaces/domain/workspace-role"

export const workspaceKinds = ["personal", "shared"] as const

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    kind: varchar("kind", { length: 16 }).default("personal").notNull(),
    // Mirrors defaultTimezone in features/reminders/domain/timezone.ts.
    timezone: varchar("timezone", { length: 64 }).default("UTC").notNull(),
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
      "workspaces_kind_check",
      sql`${table.kind} in ('personal', 'shared')`,
    ),
    check("workspaces_version_check", sql`${table.version} > 0`),
    uniqueIndex("workspaces_active_slug_unique")
      .on(sql`lower(${table.slug})`)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("workspaces_personal_owner_unique")
      .on(table.ownerUserId)
      .where(sql`${table.kind} = 'personal' and ${table.deletedAt} is null`),
    index("workspaces_owner_user_id_idx").on(table.ownerUserId),
  ],
)

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 16 }).$type<WorkspaceRole>().notNull(),
    joinedAt: timestamp("joined_at", { mode: "date", withTimezone: true })
      .defaultNow()
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
    check(
      "workspace_members_role_check",
      sql`${table.role} in ('owner', 'admin', 'member')`,
    ),
    check("workspace_members_version_check", sql`${table.version} > 0`),
    uniqueIndex("workspace_members_active_membership_unique")
      .on(table.workspaceId, table.userId)
      .where(sql`${table.deletedAt} is null`),
    index("workspace_members_workspace_id_idx").on(table.workspaceId),
    index("workspace_members_user_id_idx").on(table.userId),
  ],
)
