import "server-only"

import webPush from "web-push"

import type { DatabaseExecutor } from "@/db/client"
import {
  createTrustedPushAgent,
  UnsafePushEndpointError,
} from "@/features/reminders/delivery/push-endpoint-security"
import {
  deletePushSubscriptionByEndpoint,
  listPushSubscriptionRecords,
  recordPushDeliveryFailure,
  recordPushDeliverySuccess,
} from "@/features/reminders/repositories/push-subscription-repository"

export type PushDeliveryConfiguration = Readonly<{
  privateKey: string
  publicKey: string
  subject: string
}>

const deliveryConcurrency = 4
const deliveryTimeoutMilliseconds = 5_000
const failureThreshold = 3

async function deliverSubscription(
  database: DatabaseExecutor,
  subscription: Awaited<ReturnType<typeof listPushSubscriptionRecords>>[number],
  payload: string,
  configuration: PushDeliveryConfiguration,
) {
  let agent: Awaited<ReturnType<typeof createTrustedPushAgent>> | undefined
  try {
    agent = await createTrustedPushAgent(subscription.endpoint)
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime?.getTime() ?? null,
        keys: { auth: subscription.auth, p256dh: subscription.p256dh },
      },
      payload,
      {
        TTL: 3_600,
        vapidDetails: configuration,
        timeout: deliveryTimeoutMilliseconds,
        // web-push uses Node's https.request, which does not follow 3xx
        // responses. This pinned agent also prevents a fresh DNS lookup.
        agent,
      },
    )
    await recordPushDeliverySuccess(database, subscription.endpoint)
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? Number(error.statusCode)
        : 0
    if (
      error instanceof UnsafePushEndpointError ||
      statusCode === 404 ||
      statusCode === 410
    ) {
      await deletePushSubscriptionByEndpoint(database, subscription.endpoint)
      return
    }
    const removed = await recordPushDeliveryFailure(
      database,
      subscription.endpoint,
      failureThreshold,
    )
    console.error("Push reminder delivery failed", {
      removed,
      statusCode: statusCode || "provider_failure",
    })
  } finally {
    agent?.destroy()
  }
}

export async function sendPushReminder(
  database: DatabaseExecutor,
  userId: string,
  questId: string,
  configuration: PushDeliveryConfiguration,
) {
  const subscriptions = await listPushSubscriptionRecords(database, userId)
  const payload = JSON.stringify({
    body: "A task reminder is due. Open Daymark to review it.",
    tag: `task-reminder-${questId}`,
    title: "Daymark reminder",
    url: `/today?task=${encodeURIComponent(questId)}`,
  })

  let index = 0
  async function worker() {
    while (index < subscriptions.length) {
      const subscription = subscriptions[index]
      index += 1
      if (subscription) {
        await deliverSubscription(
          database,
          subscription,
          payload,
          configuration,
        )
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(deliveryConcurrency, subscriptions.length) },
      worker,
    ),
  )
}
