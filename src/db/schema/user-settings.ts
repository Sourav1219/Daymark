import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { users } from "./authentication"

export const userSettings = pgTable(
  "user_settings",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    // Mirrors defaultTimezone in features/reminders/domain/timezone.ts.
    timezone: varchar("timezone", { length: 64 }).default("UTC").notNull(),
    emailRemindersEnabled: boolean("email_reminders_enabled")
      .default(true)
      .notNull(),
    timezoneConfirmedAt: timestamp("timezone_confirmed_at", {
      mode: "date",
      withTimezone: true,
    }),
    onboardingCompletedAt: timestamp("onboarding_completed_at", {
      mode: "date",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [check("user_settings_version_check", sql`${table.version} > 0`)],
)
