"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { Route } from "next"
import { useRouter } from "next/navigation"

import { SessionExpiredCard } from "@/features/authentication/ui/session-expired-card"
import { clearPrivateOfflineData } from "@/features/offline/storage/offline-database"

const SESSION_CHECK_INTERVAL_MS = 10 * 60 * 1_000
const SESSION_CHECK_DEDUPLICATION_MS = 30 * 1_000
const SHARED_SESSION_CHECK_WINDOW_MS = 9 * 60 * 1_000
const SHARED_SESSION_CHECK_KEY = "traketo:last-session-check:v1"

function recentlyCheckedInAnotherTab(now: number) {
  try {
    const lastCheckedAt = Number.parseInt(
      window.localStorage.getItem(SHARED_SESSION_CHECK_KEY) ?? "0",
      10,
    )
    if (
      lastCheckedAt > 0 &&
      now >= lastCheckedAt &&
      now - lastCheckedAt < SHARED_SESSION_CHECK_WINDOW_MS
    ) {
      return true
    }
    window.localStorage.setItem(SHARED_SESSION_CHECK_KEY, String(now))
  } catch {
    // Storage can be unavailable in hardened/private browser contexts. The
    // per-tab guard below still prevents duplicate focus/visibility checks.
  }
  return false
}

/**
 * Silent background watcher mounted inside the authenticated app shell.
 *
 * Checks /api/session/ping initially, periodically while visible, and whenever
 * the tab regains focus. This keeps remote-revocation detection automatic
 * without holding an always-open server function for every browser tab.
 * When the server returns 401 (session expired or revoked), it clears local
 * offline data and navigates to the real sign-out route.
 *
 * Renders nothing; purely an effect component.
 */
export function SessionWatcher() {
  const router = useRouter()
  const checkingRef = useRef(false)
  const expiredRef = useRef(false)
  const lastCheckedAtRef = useRef(0)
  const [expired, setExpired] = useState(false)

  const expireSession = useCallback(() => {
    if (expiredRef.current) return
    expiredRef.current = true
    setExpired(true)
    void clearPrivateOfflineData()
    const nextPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
    router.replace(`/sign-out?next=${encodeURIComponent(nextPath)}` as Route)
  }, [router])

  const checkSession = useCallback(
    async (force = false) => {
      if (expiredRef.current || document.visibilityState !== "visible") {
        return false
      }
      const now = Date.now()
      if (
        checkingRef.current ||
        (!force &&
          (now - lastCheckedAtRef.current < SESSION_CHECK_DEDUPLICATION_MS ||
            recentlyCheckedInAnotherTab(now)))
      ) {
        return false
      }

      checkingRef.current = true
      lastCheckedAtRef.current = now
      try {
        window.localStorage.setItem(SHARED_SESSION_CHECK_KEY, String(now))
      } catch {
        // See the storage fallback above.
      }

      try {
        const response = await fetch("/api/session/ping", {
          cache: "no-store",
          credentials: "same-origin",
        })

        if (response.status === 401) {
          expireSession()
          return false
        }
        return response.ok
      } catch {
        // Network/fetch error — assume offline, don't sign the user out.
        return false
      } finally {
        checkingRef.current = false
      }
    },
    [expireSession],
  )

  useEffect(() => {
    void checkSession(true)

    const interval = window.setInterval(
      () => void checkSession(),
      SESSION_CHECK_INTERVAL_MS,
    )

    // Also probe promptly when the user returns to the app. The short
    // deduplication window prevents focus + visibility events from doubling
    // the request.
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void checkSession()
      }
    }
    const onFocus = () => void checkSession()
    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("focus", onFocus)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("focus", onFocus)
    }
  }, [checkSession])

  if (!expired || typeof document === "undefined") return null

  return createPortal(
    <div
      aria-live="assertive"
      className="fixed inset-0 z-[100] overflow-y-auto"
      data-session-expired-overlay
    >
      <SessionExpiredCard
        description="This device was signed out from another active session. Your data remains safe—sign in again whenever you are ready."
        heading="This device has been signed out."
      />
    </div>,
    document.body,
  )
}
