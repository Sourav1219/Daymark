import "server-only"

import type { Database } from "@/db/client"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { ReminderServiceError } from "@/features/reminders/domain/errors"
import {
  findUserSettingsRecord,
  updateUserTimezoneRecord,
  type UserSettingsRecord,
} from "@/features/reminders/repositories/user-settings-repository"
import type { UpdateTimezoneCommand } from "@/features/reminders/validation/reminder-validation"
import { lockWorkspaceForMutation } from "@/features/workspaces/infrastructure/workspace-access-repository"

export async function updateUserTimezone(
  database: Database,
  access: AccessContext,
  command: UpdateTimezoneCommand,
): Promise<UserSettingsRecord> {
  return database.transaction(async (transaction) => {
    if (!(await lockWorkspaceForMutation(transaction, access))) {
      throw new ReminderServiceError(
        "FORBIDDEN",
        "Workspace access is no longer active.",
      )
    }

    const updated = await updateUserTimezoneRecord(transaction, access, command)
    if (updated) return updated

    const current = await findUserSettingsRecord(transaction, access)
    if (!current) {
      throw new ReminderServiceError("NOT_FOUND", "User settings not found.")
    }

    throw new ReminderServiceError(
      "CONFLICT",
      "Timezone settings were updated elsewhere. Refresh and try again.",
    )
  })
}
