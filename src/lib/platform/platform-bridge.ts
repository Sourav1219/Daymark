/**
 * Unified Native Platform & Haptics Bridge
 *
 * Provides a unified interface for:
 * 1. Runtime environment detection (Android WebAPK/PWA, Capacitor, Tauri, Browser).
 * 2. Tactile micro-haptic feedback via Android navigator.vibrate or native plugins.
 * 3. App icon badging on Android Home Screen / Launcher via the Badging API.
 */

export type HapticType = "selection" | "success" | "warning" | "heavy"
export type PlatformType = "android" | "ios" | "web"

const HAPTIC_PATTERNS: Readonly<Record<HapticType, number | number[]>> = {
  selection: 10,
  heavy: 30,
  success: [20, 40, 30],
  warning: [40, 60, 40],
}

/**
 * Detects if the app is running in an installed standalone container
 * (Android WebAPK/PWA, iOS Home Screen PWA, Capacitor, or Tauri).
 */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false

  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (window.navigator as unknown as { standalone?: boolean })?.standalone ===
      true

  const isCapacitor = Boolean(
    (
      window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
    )?.Capacitor?.isNativePlatform?.(),
  )

  const isTauri = Boolean(
    (window as unknown as { __TAURI__?: unknown })?.__TAURI__,
  )

  return Boolean(isStandalone || isCapacitor || isTauri)
}

/**
 * Detects if the app is running specifically inside an embedded native Capacitor container
 * (where Google blocks OAuth in WebViews with 403 disallowed_useragent).
 */
export function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false
  return Boolean(
    (
      window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
    )?.Capacitor?.isNativePlatform?.(),
  )
}

/**
 * Identifies the host operating system platform.
 */
export function getPlatform(): PlatformType {
  if (typeof window === "undefined") return "web"

  const ua = window.navigator.userAgent.toLowerCase()
  if (/android/.test(ua)) return "android"
  if (/iphone|ipad|ipod/.test(ua)) return "ios"
  return "web"
}

/**
 * Triggers tactile micro-haptic vibrations.
 * Uses native Capacitor Haptics if installed, or Android navigator.vibrate.
 * Gracefully handles headless environments or battery-saver restrictions.
 */
export function triggerHaptic(type: HapticType = "selection"): void {
  if (typeof window === "undefined") return

  // 1. Capacitor native bridge if present
  const capHaptics = (
    window as unknown as {
      Capacitor?: {
        Plugins?: {
          Haptics?: {
            impact?: (opts: { style: string }) => Promise<void>
            notification?: (opts: { type: string }) => Promise<void>
          }
        }
      }
    }
  )?.Capacitor?.Plugins?.Haptics

  if (capHaptics) {
    try {
      if (type === "success") {
        void capHaptics.notification?.({ type: "SUCCESS" })
      } else if (type === "warning") {
        void capHaptics.notification?.({ type: "WARNING" })
      } else if (type === "heavy") {
        void capHaptics.impact?.({ style: "HEAVY" })
      } else {
        void capHaptics.impact?.({ style: "LIGHT" })
      }
      return
    } catch {
      // Fallback to navigator.vibrate
    }
  }

  // 2. Standard Web / Android Vibration API
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function"
  ) {
    try {
      const pattern = HAPTIC_PATTERNS[type] ?? 10
      navigator.vibrate(pattern)
    } catch {
      // Silent catch if device restricts vibration
    }
  }
}

/**
 * Sets the notification badge count on the app icon (Android Home Screen WebAPK / PWA).
 */
export async function setAppBadge(count: number): Promise<void> {
  if (typeof navigator === "undefined") return

  try {
    const nav = navigator as unknown as {
      setAppBadge?: (count: number) => Promise<void>
      clearAppBadge?: () => Promise<void>
    }

    if (count > 0 && typeof nav.setAppBadge === "function") {
      await nav.setAppBadge(count)
    } else if (typeof nav.clearAppBadge === "function") {
      await nav.clearAppBadge()
    }
  } catch {
    // Badging API is progressive; silently ignore if not supported
  }
}

/**
 * Clears the app icon badge count from the Android Home Screen.
 */
export async function clearAppBadge(): Promise<void> {
  if (typeof navigator === "undefined") return

  try {
    const nav = navigator as unknown as {
      clearAppBadge?: () => Promise<void>
    }

    if (typeof nav.clearAppBadge === "function") {
      await nav.clearAppBadge()
    }
  } catch {
    // Silently ignore if not supported
  }
}

let localTimerFallbackTimeout: ReturnType<typeof setTimeout> | null = null

export type ScheduleTimerOptions = {
  targetTimestamp: number
  title?: string
  body?: string
  tag?: string
}

/**
 * Requests notification permissions on Android / Web.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false
  try {
    if (Notification.permission === "granted") return true
    if (Notification.permission !== "denied") {
      const status = await Notification.requestPermission()
      return status === "granted"
    }
  } catch {
    // Ignore permissions failure
  }
  return false
}

/**
 * Schedules an OS-level background timer notification.
 * Fires a high-priority Heads-up notification on Android when focus completes,
 * even when the screen is locked or another app is open.
 */
export async function scheduleTimerNotification(
  options: ScheduleTimerOptions,
): Promise<void> {
  if (typeof window === "undefined") return

  const {
    targetTimestamp,
    title = "Focus block complete! 🎯",
    body = "Great work! Time for a short break or stretch.",
    tag = "timer-completion",
  } = options

  // Clear existing pending timer fallback
  if (localTimerFallbackTimeout) {
    clearTimeout(localTimerFallbackTimeout)
    localTimerFallbackTimeout = null
  }

  // 1. Capacitor Native LocalNotifications (Android APK)
  const capLocalNotifications = (
    window as unknown as {
      Capacitor?: {
        Plugins?: {
          LocalNotifications?: {
            schedule?: (opts: {
              notifications: Array<{
                id: number
                title: string
                body: string
                schedule: { at: Date }
                sound?: string
              }>
            }) => Promise<void>
          }
        }
      }
    }
  )?.Capacitor?.Plugins?.LocalNotifications

  if (capLocalNotifications?.schedule) {
    try {
      await capLocalNotifications.schedule({
        notifications: [
          {
            id: 1001,
            title,
            body,
            schedule: { at: new Date(targetTimestamp) },
            sound: "default",
          },
        ],
      })
      return
    } catch {
      // Fall through to Service Worker
    }
  }

  // 2. Service Worker Background Notification (Android Chrome / WebAPK)
  if (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    navigator.serviceWorker.controller
  ) {
    try {
      navigator.serviceWorker.controller.postMessage({
        type: "SCHEDULE_TIMER_NOTIFICATION",
        targetTimestamp,
        title,
        body,
        tag,
      })
    } catch {
      // Silently catch postMessage errors
    }
  }

  // 3. In-tab timeout fallback
  const delay = Math.max(0, targetTimestamp - Date.now())
  localTimerFallbackTimeout = setTimeout(() => {
    localTimerFallbackTimeout = null
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification(title, {
          body,
          icon: "/icons/traketo-icon-192.png",
          tag,
        })
      } catch {
        // Ignore notification instantiation errors
      }
    }
  }, delay)
}

/**
 * Immediately cancels any scheduled OS timer notification.
 */
export async function cancelTimerNotification(
  tag: string = "timer-completion",
): Promise<void> {
  if (typeof window === "undefined") return

  if (localTimerFallbackTimeout) {
    clearTimeout(localTimerFallbackTimeout)
    localTimerFallbackTimeout = null
  }

  // 1. Capacitor LocalNotifications cancellation
  const capLocalNotifications = (
    window as unknown as {
      Capacitor?: {
        Plugins?: {
          LocalNotifications?: {
            cancel?: (opts: {
              notifications: Array<{ id: number }>
            }) => Promise<void>
          }
        }
      }
    }
  )?.Capacitor?.Plugins?.LocalNotifications

  if (capLocalNotifications?.cancel) {
    try {
      await capLocalNotifications.cancel({ notifications: [{ id: 1001 }] })
    } catch {
      // Ignore
    }
  }

  // 2. Service Worker cancellation
  if (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    navigator.serviceWorker.controller
  ) {
    try {
      navigator.serviceWorker.controller.postMessage({
        type: "CANCEL_TIMER_NOTIFICATION",
        tag,
      })
    } catch {
      // Ignore
    }
  }
}

/**
 * Opens an external authentication URL in the system browser or Chrome Custom Tab.
 * On Android Capacitor, this invokes Chrome Custom Tabs to prevent Google 403 disallowed_useragent.
 * On Web, it falls back to window.location.assign.
 */
export async function openAuthSession(url: string): Promise<void> {
  if (typeof window === "undefined") return

  const capBrowser = (
    window as unknown as {
      Capacitor?: {
        Plugins?: {
          Browser?: {
            open?: (opts: { url: string; windowName?: string }) => Promise<void>
          }
        }
      }
    }
  )?.Capacitor?.Plugins?.Browser

  if (capBrowser?.open) {
    try {
      await capBrowser.open({ url, windowName: "_system" })
      return
    } catch {
      // Fall through
    }
  }

  window.location.assign(url)
}

/**
 * Closes an active Chrome Custom Tab or browser session if opened via native plugin.
 */
export async function closeAuthSession(): Promise<void> {
  if (typeof window === "undefined") return

  const capBrowser = (
    window as unknown as {
      Capacitor?: {
        Plugins?: {
          Browser?: {
            close?: () => Promise<void>
          }
        }
      }
    }
  )?.Capacitor?.Plugins?.Browser

  if (capBrowser?.close) {
    try {
      await capBrowser.close()
    } catch {
      // Ignore
    }
  }
}

/**
 * Sets up a listener for deep link returns (e.g., traketo://auth/callback or daymark://auth/callback)
 * when returning from an external authentication session on Android.
 */
export function setupAuthDeepLinkListener(
  onDeepLink: (url: string) => void,
): () => void {
  if (typeof window === "undefined") return () => {}

  const capApp = (
    window as unknown as {
      Capacitor?: {
        Plugins?: {
          App?: {
            addListener?: (
              eventName: string,
              listener: (data: { url: string }) => void,
            ) => Promise<{ remove: () => void }> | { remove: () => void }
          }
        }
      }
    }
  )?.Capacitor?.Plugins?.App

  let handle: { remove: () => void } | null = null

  if (capApp?.addListener) {
    try {
      const result = capApp.addListener("appUrlOpen", (data) => {
        if (data?.url) {
          onDeepLink(data.url)
        }
      })
      if (result && typeof (result as Promise<unknown>).then === "function") {
        void (result as Promise<{ remove: () => void }>).then((h) => {
          handle = h
        })
      } else {
        handle = result as { remove: () => void }
      }
    } catch {
      // Ignore
    }
  }

  // Also support custom daymark:deeplink window events for tests / custom triggers
  const windowListener = (event: Event) => {
    const customEvent = event as CustomEvent<{ url: string }>
    if (customEvent.detail?.url) {
      onDeepLink(customEvent.detail.url)
    }
  }
  window.addEventListener("daymark:deeplink", windowListener)

  return () => {
    handle?.remove?.()
    window.removeEventListener("daymark:deeplink", windowListener)
  }
}
