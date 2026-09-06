import "server-only"

import { eq, lt } from "drizzle-orm"

import type { DatabaseExecutor } from "@/db/client"
import { verifications } from "@/db/schema"

/**
 * Deletes all verification rows (OTP / email-verification tokens) whose
 * `expires_at` is strictly before `cutoff`.
 *
 * These rows are created during email-verification and password-reset flows.
 * When a registration is abandoned the token expires but no later step
 * removes the row, leaving PII (the email address stored in `identifier`)
 * in the table indefinitely.  This function is called by the retention cron
 * to reclaim those orphaned rows.
 */
export async function deleteExpiredVerificationsBefore(
  database: DatabaseExecutor,
  cutoff: Date,
): Promise<number> {
  const deleted = await database
    .delete(verifications)
    .where(lt(verifications.expiresAt, cutoff))
    .returning({ id: verifications.id })

  return deleted.length
}

/**
 * Deletes every verification row whose `identifier` matches the supplied
 * email address.  Called during account deletion so that outstanding
 * (and expired-but-not-yet-swept) OTP rows tied to the user's email are
 * removed atomically within the same transaction.
 */
export async function deleteVerificationsByIdentifier(
  database: DatabaseExecutor,
  identifier: string,
): Promise<number> {
  const deleted = await database
    .delete(verifications)
    .where(eq(verifications.identifier, identifier))
    .returning({ id: verifications.id })

  return deleted.length
}
