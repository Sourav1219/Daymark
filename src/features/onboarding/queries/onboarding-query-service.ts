import "server-only"

import { getDatabase, type Database } from "@/db/client"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { getUserSettings } from "@/features/reminders/queries/user-settings-query-service"

export async function getOnboardingStatus(
  access: AccessContext,
  database: Database = getDatabase(),
) {
  const settings = await getUserSettings(access, database)

  return {
    timezone: settings.timezone,
    timezoneConfirmed: Boolean(settings.timezoneConfirmedAt),
    version: settings.version,
  } as const
}
