import "server-only"

import { getDatabase, type Database } from "@/db/client"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import {
  listDueSoonQuestViews,
  listNotificationViews,
  listReminderViews,
} from "@/features/reminders/repositories/reminder-repository"

export function getReminderList(
  access: AccessContext,
  database: Database = getDatabase(),
) {
  return listReminderViews(database, access)
}

export function getNotificationList(
  access: AccessContext,
  database: Database = getDatabase(),
) {
  return listNotificationViews(database, access)
}

const automaticDeadlineWindowMs = 30 * 60_000

export async function getReminderInbox(
  access: AccessContext,
  options: Readonly<{ database?: Database; now?: Date }> = {},
) {
  const database = options.database ?? getDatabase()
  const now = options.now ?? new Date()

  const dueSoonQuests = await listDueSoonQuestViews(database, access, {
    now,
    until: new Date(now.getTime() + automaticDeadlineWindowMs),
  })

  return { dueSoonQuests } as const
}
