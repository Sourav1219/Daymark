import "server-only"

import { and, desc, eq, inArray, sql } from "drizzle-orm"

import type { Database, DatabaseExecutor } from "@/db/client"
import { pushSubscriptions } from "@/db/schema"
import { ReminderServiceError } from "@/features/reminders/domain/errors"
import {
  pushSubscriptionQuotaAvailable,
  resourceQuotas,
  ResourceQuotaError,
} from "@/lib/resource-quotas"

export async function savePushSubscriptionRecord(
  database: Database,
  input: Readonly<{
    auth: string
    endpoint: string
    expirationTime: Date | null
    p256dh: string
    userId: string
  }>,
) {
  return database.transaction(async (transaction) => {
    // Serialize subscription creates for this user so concurrent devices
    // cannot all observe a free quota slot.
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`push-subscriptions:${input.userId}`}, 0))`,
    )
    const [existing] = await transaction
      .select({ userId: pushSubscriptions.userId })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, input.endpoint))
      .limit(1)

    // An endpoint is bound to the account that created it. A caller who
    // learned another user's endpoint URL can never take ownership of it.
    if (existing && existing.userId !== input.userId) {
      throw new ReminderServiceError(
        "CONFLICT",
        "This notification endpoint belongs to a different account.",
      )
    }

    if (
      !existing &&
      !(await pushSubscriptionQuotaAvailable(transaction, input.userId))
    ) {
      throw new ResourceQuotaError(
        "This account has reached its push subscription quota.",
      )
    }

    const [record] = await transaction
      .insert(pushSubscriptions)
      .values(input)
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          auth: input.auth,
          expirationTime: input.expirationTime,
          p256dh: input.p256dh,
          updatedAt: new Date(),
        },
      })
      .returning({ id: pushSubscriptions.id })

    return record ?? null
  })
}

export async function deletePushSubscriptionRecord(
  database: DatabaseExecutor,
  userId: string,
  endpoint: string,
) {
  await database
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint),
      ),
    )
}

export async function deletePushSubscriptionByEndpoint(
  database: DatabaseExecutor,
  endpoint: string,
) {
  await database
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint))
}

export async function listPushSubscriptionRecords(
  database: DatabaseExecutor,
  userId: string,
) {
  const records = await database
    .select({
      auth: pushSubscriptions.auth,
      endpoint: pushSubscriptions.endpoint,
      expirationTime: pushSubscriptions.expirationTime,
      p256dh: pushSubscriptions.p256dh,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .orderBy(desc(pushSubscriptions.updatedAt))
    .limit(resourceQuotas.pushSubscriptionsPerUser + 1)

  const excess = records.slice(resourceQuotas.pushSubscriptionsPerUser)
  if (excess.length > 0) {
    await database.delete(pushSubscriptions).where(
      inArray(
        pushSubscriptions.endpoint,
        excess.map((record) => record.endpoint),
      ),
    )
  }

  return records.slice(0, resourceQuotas.pushSubscriptionsPerUser)
}

export async function recordPushDeliverySuccess(
  database: DatabaseExecutor,
  endpoint: string,
) {
  await database
    .update(pushSubscriptions)
    .set({ consecutiveFailureCount: 0, lastFailureAt: null })
    .where(eq(pushSubscriptions.endpoint, endpoint))
}

export async function recordPushDeliveryFailure(
  database: DatabaseExecutor,
  endpoint: string,
  failureThreshold: number,
) {
  const [updated] = await database
    .update(pushSubscriptions)
    .set({
      consecutiveFailureCount: sql`${pushSubscriptions.consecutiveFailureCount} + 1`,
      lastFailureAt: new Date(),
    })
    .where(eq(pushSubscriptions.endpoint, endpoint))
    .returning({ count: pushSubscriptions.consecutiveFailureCount })

  if (!updated || updated.count < failureThreshold) return false

  await database
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.endpoint, endpoint),
        sql`${pushSubscriptions.consecutiveFailureCount} >= ${failureThreshold}`,
      ),
    )
  return true
}
