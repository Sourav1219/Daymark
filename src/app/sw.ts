/// <reference lib="esnext" />
/// <reference lib="webworker" />

import type { PrecacheEntry, SerwistGlobalConfig } from "serwist"
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from "serwist"

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const cacheVersion = "v3"
const cachePrefix = "questly-"
const currentCaches = new Set([
  `${cachePrefix}media-${cacheVersion}`,
  `${cachePrefix}static-${cacheVersion}`,
])

const serwist = new Serwist({
  cacheId: `questly-pwa-${cacheVersion}`,
  clientsClaim: true,
  disableDevLogs: true,
  fallbacks: {
    entries: [
      {
        matcher: ({ request }) => request.destination === "document",
        url: "/~offline",
      },
    ],
  },
  navigationPreload: true,
  precacheEntries: self.__SW_MANIFEST ?? [],
  runtimeCaching: [
    {
      handler: new NetworkOnly(),
      matcher: ({ request, sameOrigin }) =>
        sameOrigin && request.mode === "navigate",
    },
    {
      handler: new CacheFirst({
        cacheName: `${cachePrefix}static-${cacheVersion}`,
        plugins: [new ExpirationPlugin({ maxEntries: 80 })],
      }),
      matcher: ({ request, sameOrigin, url }) =>
        sameOrigin &&
        url.pathname.startsWith("/_next/static/") &&
        ["font", "script", "style"].includes(request.destination),
    },
    {
      handler: new StaleWhileRevalidate({
        cacheName: `${cachePrefix}media-${cacheVersion}`,
        plugins: [new ExpirationPlugin({ maxEntries: 24 })],
      }),
      matcher: ({ request, sameOrigin, url }) =>
        sameOrigin &&
        request.destination === "image" &&
        (url.pathname.startsWith("/icons/") ||
          url.pathname.startsWith("/splash/")),
    },
  ],
  skipWaiting: true,
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (name) =>
                name.startsWith(cachePrefix) &&
                !name.includes(cacheVersion) &&
                !currentCaches.has(name),
            )
            .map((name) => caches.delete(name)),
        ),
      ),
  )
})

let scheduledTimerTimeout: ReturnType<typeof setTimeout> | null = null

self.addEventListener("message", (event) => {
  if (event.data === "QUESTLY_CLEAR_PRIVATE_DATA") {
    event.waitUntil(
      caches
        .keys()
        .then((names) =>
          Promise.all(
            names
              .filter((name) => name.startsWith("questly-private-"))
              .map((name) => caches.delete(name)),
          ),
        ),
    )
    return
  }

  if (event.data?.type === "SCHEDULE_TIMER_NOTIFICATION") {
    const { targetTimestamp, title, body, tag } = event.data as {
      targetTimestamp: number
      title?: string
      body?: string
      tag?: string
    }

    if (scheduledTimerTimeout) {
      clearTimeout(scheduledTimerTimeout)
      scheduledTimerTimeout = null
    }

    const delay = Math.max(0, targetTimestamp - Date.now())
    scheduledTimerTimeout = setTimeout(() => {
      scheduledTimerTimeout = null
      void self.registration.showNotification(
        title || "Focus block complete! 🎯",
        {
          badge: "/icons/traketo-icon-192.png",
          body: body || "Great work! Time for a short break or stretch.",
          data: { url: "/timer" },
          icon: "/icons/traketo-icon-192.png",
          tag: tag || "timer-completion",
          vibrate: [200, 100, 200, 100, 200],
        } as NotificationOptions,
      )
    }, delay)
    return
  }

  if (event.data?.type === "CANCEL_TIMER_NOTIFICATION") {
    if (scheduledTimerTimeout) {
      clearTimeout(scheduledTimerTimeout)
      scheduledTimerTimeout = null
    }
    const targetTag =
      (event.data?.tag as string | undefined) || "timer-completion"
    event.waitUntil(
      self.registration
        .getNotifications({ tag: targetTag })
        .then((notifications) => {
          notifications.forEach((n) => n.close())
        }),
    )
  }
})

self.addEventListener("push", (event) => {
  const payload = event.data?.json() as
    { body?: string; tag?: string; title?: string; url?: string } | undefined
  event.waitUntil(
    self.registration.showNotification(payload?.title ?? "Traketo reminder", {
      badge: "/icons/traketo-icon-192.png",
      body: payload?.body ?? "A task reminder is due.",
      data: { url: payload?.url ?? "/today" },
      icon: "/icons/traketo-icon-192.png",
      tag: payload?.tag ?? "traketo-reminder",
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  // Push payloads are server-generated, but resolve defensively anyway: an
  // absolute URL pointing off-origin must never become a navigation target.
  let url = new URL("/today", self.location.origin)
  try {
    const requested = new URL(
      String(
        (event.notification.data as { url?: string } | null)?.url ?? "/today",
      ),
      self.location.origin,
    )
    if (requested.origin === self.location.origin) {
      url = requested
    }
  } catch {
    // Keep the default /today fallback for malformed payload URLs.
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then(async (clients) => {
      const existing = clients.find((client) =>
        client.url.startsWith(self.location.origin),
      )
      if (existing && "navigate" in existing) {
        await existing.navigate(url.href)
        return existing.focus()
      }
      return self.clients.openWindow(url.href)
    }),
  )
})

serwist.addEventListeners()
