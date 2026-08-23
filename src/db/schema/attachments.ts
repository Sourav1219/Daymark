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
  AllowedAttachmentMimeType,
  AttachmentStatus,
} from "@/features/attachments/domain/types"

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    questId: uuid("quest_id").notNull(),
    uploadedByUserId: uuid("uploaded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    storageKey: varchar("storage_key", { length: 512 }).notNull(),
    displayName: varchar("display_name", { length: 160 })
      .default("Pending attachment")
      .notNull(),
    status: varchar("status", { length: 16 })
      .$type<AttachmentStatus>()
      .default("pending")
      .notNull(),
    requestedContentType: varchar("requested_content_type", { length: 128 })
      .$type<AllowedAttachmentMimeType>()
      .notNull(),
    contentType: varchar("content_type", {
      length: 128,
    }).$type<AllowedAttachmentMimeType>(),
    expectedByteSize: integer("expected_byte_size").notNull(),
    byteSize: integer("byte_size"),
    uploadExpiresAt: timestamp("upload_expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    readyAt: timestamp("ready_at", { mode: "date", withTimezone: true }),
    failureCode: varchar("failure_code", { length: 48 }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    check(
      "attachments_status_check",
      sql`${table.status} in ('pending', 'ready', 'deleting', 'deleted', 'failed')`,
    ),
    check(
      "attachments_requested_content_type_check",
      sql`${table.requestedContentType} in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')`,
    ),
    check(
      "attachments_content_type_check",
      sql`${table.contentType} is null or ${table.contentType} in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')`,
    ),
    check(
      "attachments_expected_size_check",
      sql`${table.expectedByteSize} between 1 and 10485760`,
    ),
    check(
      "attachments_size_check",
      sql`${table.byteSize} is null or ${table.byteSize} between 1 and 10485760`,
    ),
    check("attachments_version_check", sql`${table.version} > 0`),
    unique("attachments_id_workspace_unique").on(table.id, table.workspaceId),
    uniqueIndex("attachments_storage_key_unique").on(table.storageKey),
    foreignKey({
      columns: [table.questId, table.workspaceId],
      foreignColumns: [tasks.id, tasks.workspaceId],
      name: "attachments_quest_workspace_fk",
    }).onDelete("restrict"),
    index("attachments_workspace_quest_idx").on(
      table.workspaceId,
      table.questId,
      table.deletedAt,
    ),
    index("attachments_pending_expiry_idx")
      .on(table.status, table.uploadExpiresAt)
      .where(
        sql`${table.deletedAt} is null and ${table.status} in ('pending', 'deleting')`,
      ),
  ],
)
