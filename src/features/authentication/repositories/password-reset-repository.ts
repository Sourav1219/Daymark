import "server-only"

import { and, eq, gt } from "drizzle-orm"

import { getDatabase } from "@/db/client"
import { verifications } from "@/db/schema"
import { passwordResetTokenSchema } from "@/features/authentication/application/validation"

export async function isPasswordResetTokenActive(
  untrustedToken: string,
): Promise<boolean> {
  const parsed = passwordResetTokenSchema.safeParse(untrustedToken)
  if (!parsed.success) return false

  const [verification] = await getDatabase()
    .select({ id: verifications.id })
    .from(verifications)
    .where(
      and(
        eq(verifications.identifier, `reset-password:${parsed.data}`),
        gt(verifications.expiresAt, new Date()),
      ),
    )
    .limit(1)

  return Boolean(verification)
}
