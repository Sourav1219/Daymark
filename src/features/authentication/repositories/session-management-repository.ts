import "server-only"

import { and, desc, eq, gt } from "drizzle-orm"

import type { DatabaseExecutor } from "@/db/client"
import { sessions } from "@/db/schema"

export type ActiveSessionRecord = Readonly<{
  createdAt: Date
  expiresAt: Date
  id: string
  ipAddress: string | null
  userAgent: string | null
}>

export const LOCALHOST_IP_PATTERN =
  /^(::1?|127(?:\.\d{1,3}){3}|::ffff:127(?:\.\d{1,3}){3}|(?:0000:){7}000[01]|(?:0000:){7}0000|0\.0\.0\.0|::|localhost)$/i

export function isLocalhostSession(session: {
  ipAddress?: string | null
  userAgent?: string | null
}): boolean {
  if (
    session.ipAddress &&
    LOCALHOST_IP_PATTERN.test(session.ipAddress.trim())
  ) {
    return true
  }
  if (
    session.userAgent &&
    /(?:headlesschrome|playwright|curl\/)/i.test(session.userAgent)
  ) {
    return true
  }
  return false
}

export async function listActiveSessionRecords(
  database: DatabaseExecutor,
  userId: string,
  now: Date,
  options?: Readonly<{ includeLocalhost?: boolean }>,
): Promise<readonly ActiveSessionRecord[]> {
  const records = await database
    .select({
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
      id: sessions.id,
      ipAddress: sessions.ipAddress,
      userAgent: sessions.userAgent,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now)))
    .orderBy(desc(sessions.createdAt))

  if (options?.includeLocalhost) {
    return records
  }

  return records.filter((record) => !isLocalhostSession(record))
}

/** Revokes one session owned by the user; returns whether a row was removed. */
export async function revokeSessionRecord(
  database: DatabaseExecutor,
  input: Readonly<{ sessionId: string; userId: string }>,
): Promise<boolean> {
  const revoked = await database
    .delete(sessions)
    .where(
      and(eq(sessions.id, input.sessionId), eq(sessions.userId, input.userId)),
    )
    .returning({ id: sessions.id })

  return revoked.length > 0
}

/** Signs the user out of every device, including the current session. */
export async function revokeAllSessionRecords(
  database: DatabaseExecutor,
  userId: string,
): Promise<number> {
  const revoked = await database
    .delete(sessions)
    .where(eq(sessions.userId, userId))
    .returning({ id: sessions.id })

  return revoked.length
}
