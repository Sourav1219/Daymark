"use client"

import { useEffect } from "react"

import { savePushSubscriptionAction } from "@/features/reminders/application/push-actions"

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

export function requestAutomaticPushPermission() {
  if (!supportsPushNotifications() || Notification.permission !== "default") {
    return
  }
  void Notification.requestPermission()
}

async function enrollDevice(publicKey: string) {
  if (!supportsPushNotifications() || Notification.permission !== "granted") {
    return
  }

  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return

  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      applicationServerKey: applicationServerKey(publicKey),
      userVisibleOnly: true,
    }))
  const result = await savePushSubscriptionAction(subscription.toJSON())
  if (!result.ok && !existing) await subscription.unsubscribe()
}

export function AutomaticPushEnrollment({
  publicKey,
}: Readonly<{ publicKey: string | null }>) {
  useEffect(() => {
    if (!publicKey || !supportsPushNotifications()) return

    let cancelled = false
    let retry: number | undefined

    const enroll = () => {
      if (cancelled) return
      void enrollDevice(publicKey).catch(() => {
        // Push is a progressive enhancement. The in-app inbox remains the
        // source of truth when browser permission or registration fails.
      })
    }

    if (Notification.permission === "granted") {
      enroll()
      retry = window.setTimeout(enroll, 2_000)
    }

    return () => {
      cancelled = true
      if (retry) window.clearTimeout(retry)
    }
  }, [publicKey])

  return null
}
