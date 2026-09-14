import { sql } from "drizzle-orm"
import {
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { users } from "./authentication"

export const profilePhotos = pgTable(
  "profile_photos",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    imageBase64: text("image_base64").notNull(),
    contentType: varchar("content_type", { length: 32 })
      .default("image/webp")
      .notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width").default(512).notNull(),
    height: integer("height").default(512).notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "profile_photos_type_check",
      sql`${table.contentType} = 'image/webp'`,
    ),
    check(
      "profile_photos_size_check",
      sql`${table.byteSize} between 1 and 409600`,
    ),
    check(
      "profile_photos_dimensions_check",
      sql`${table.width} = 512 and ${table.height} = 512`,
    ),
    check("profile_photos_version_check", sql`${table.version} > 0`),
  ],
)
