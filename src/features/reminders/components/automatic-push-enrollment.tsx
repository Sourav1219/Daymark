"use client"

import { useEffect } from "react"

import {
  removePushSubscriptionAction,
  savePushSubscriptionAction,
} from "@/features/reminders/application/push-actions"

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4)
  const decoded = atob(
    (value + padding).replace(/-/gu, "+").replace(/_/gu, "/"),
  )
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0))
}

export function supportsPushNotifications() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  )
}

export async function getActivePushSubscription(): Promise<PushSubscription | null> {
  if (!supportsPushNotifications()) return null

  const registration = await navigator.serviceWorker.getRegistration()
  return registration?.pushManager.getSubscription() ?? null
}

export async function enablePushNotifications(
  publicKey: string,
): Promise<boolean> {
  if (!supportsPushNotifications() || Notification.permission !== "granted") {
    return false
  }

  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return false

  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      applicationServerKey: applicationServerKey(publicKey),
      userVisibleOnly: true,
    }))
  const result = await savePushSubscriptionAction(subscription.toJSON())
  if (!result.ok && !existing) await subscription.unsubscribe()
  return result.ok
}

export async function disablePushNotifications(): Promise<boolean> {
  if (!supportsPushNotifications()) return true

  const subscription = await getActivePushSubscription()
  if (!subscription) return true

  const result = await removePushSubscriptionAction({
    endpoint: subscription.endpoint,
  })
  if (!result.ok) return false

  // Removing the server record stops delivery immediately. Unsubscribing also
  // prevents this browser endpoint from being reused on a later visit.
  await subscription.unsubscribe().catch(() => false)
  return true
}

async function syncExistingSubscription(): Promise<boolean> {
  const subscription = await getActivePushSubscription()
  if (!subscription) return true

  const result = await savePushSubscriptionAction(subscription.toJSON())
  return result.ok
}

export function AutomaticPushEnrollment({
  publicKey,
}: Readonly<{ publicKey: string | null }>) {
  useEffect(() => {
    if (!publicKey || !supportsPushNotifications()) return

    let cancelled = false
    let retry: number | undefined

    const enroll = async () => {
      if (cancelled) return
      const enrolled = await syncExistingSubscription().catch(() => false)
      if (!enrolled && !cancelled) {
        // Retry once because the service worker may still be activating. A
        // successful first enrollment must not perform a duplicate server
        // action and database upsert two seconds later.
        retry = window.setTimeout(() => {
          void syncExistingSubscription().catch(() => false)
        }, 2_000)
      }
    }

    if (Notification.permission === "granted") {
      void enroll()
    }

    return () => {
      cancelled = true
      if (retry) window.clearTimeout(retry)
    }
  }, [publicKey])

  return null
}
