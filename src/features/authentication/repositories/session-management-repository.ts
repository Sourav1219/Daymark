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

export async function listActiveSessionRecords(
  database: DatabaseExecutor,
  userId: string,
  now: Date,
): Promise<readonly ActiveSessionRecord[]> {
  return database
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
