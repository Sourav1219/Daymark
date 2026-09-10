import { sql } from "drizzle-orm"
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { users } from "./authentication"
import type {
  PrivacyRequestStatus,
  PrivacyRequestType,
} from "@/features/privacy/domain/privacy-request"

export const privacyRequests = pgTable(
  "privacy_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketNumber: varchar("ticket_number", { length: 32 }).notNull(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    requesterEmail: varchar("requester_email", { length: 320 }).notNull(),
    type: varchar("type", { length: 32 }).$type<PrivacyRequestType>().notNull(),
    details: text("details").notNull(),
    status: varchar("status", { length: 16 })
      .$type<PrivacyRequestStatus>()
      .default("submitted")
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("privacy_requests_ticket_unique").on(table.ticketNumber),
    index("privacy_requests_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    check(
      "privacy_requests_type_check",
      sql`${table.type} in ('access', 'correction', 'erasure', 'portability', 'objection', 'grievance')`,
    ),
    check(
      "privacy_requests_status_check",
      sql`${table.status} in ('submitted', 'review', 'completed')`,
    ),
  ],
)
