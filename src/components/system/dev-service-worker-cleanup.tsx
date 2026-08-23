"use client"

import { useEffect } from "react"

/**
 * Development-only safeguard.
 *
 * The production service worker (src/app/sw.ts) caches `/_next/static/` assets
 * CacheFirst. Once it has been registered on an origin (e.g. after running a
 * production build locally), it keeps serving stale CSS/JS on `localhost` even
 * in `next dev` — which makes design changes appear to "not show up".
 *
 * This component runs only in development. It unregisters any existing service
 * worker, clears all Cache Storage, and reloads once so the newest assets load.
 * It is a no-op in production (the check is inlined at build time).
 */
export function DevServiceWorkerCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return
    }

    let cancelled = false

    async function cleanup() {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations()
        let changed = false

        for (const registration of registrations) {
          await registration.unregister()
          changed = true
        }

        if ("caches" in window) {
          const keys = await caches.keys()
          await Promise.all(keys.map((key) => caches.delete(key)))
          if (keys.length > 0) changed = true
        }

        if (changed && !cancelled) {
          window.location.reload()
        }
      } catch {
        // Best-effort only; never block the app on cleanup.
      }
    }

    void cleanup()

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
