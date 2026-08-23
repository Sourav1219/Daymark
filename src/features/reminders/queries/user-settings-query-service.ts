import "server-only"

import { getDatabase, type Database } from "@/db/client"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { ReminderServiceError } from "@/features/reminders/domain/errors"
import {
  findUserSettingsRecord,
  type UserSettingsRecord,
} from "@/features/reminders/repositories/user-settings-repository"

export async function getUserSettings(
  access: AccessContext,
  database: Database = getDatabase(),
): Promise<UserSettingsRecord> {
  const settings = await findUserSettingsRecord(database, access)

  if (!settings) {
    throw new ReminderServiceError(
      "FORBIDDEN",
      "User settings are unavailable.",
    )
  }

  return settings
}
