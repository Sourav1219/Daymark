import "server-only"

import { getDatabase, type Database } from "@/db/client"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { claimTodayPromoDisplay } from "@/features/today/repositories/today-promo-repository"

export function shouldShowTodayPromo(
  access: AccessContext,
  localDate: string,
  database: Database = getDatabase(),
): Promise<boolean> {
  return claimTodayPromoDisplay(database, access, localDate)
}
