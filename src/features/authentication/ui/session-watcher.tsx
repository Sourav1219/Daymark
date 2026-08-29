"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { Route } from "next"
import { useRouter } from "next/navigation"

import { SessionExpiredCard } from "@/features/authentication/ui/session-expired-card"
import { ACTIVE_SESSIONS_CHANGED_EVENT } from "@/features/authentication/client/session-events"
import { clearPrivateOfflineData } from "@/features/offline/storage/offline-database"

/**
 * Silent background watcher mounted inside the authenticated app shell.
 *
 * Checks /api/session/ping initially and on every tab-focus event.
 * Account-wide session changes arrive over the same stream,
 * allowing session lists to update immediately. When the server returns 401
 * (session revoked from another device), it clears local offline data and
 * navigates to the real sign-out route — no manual refresh required.
 *
 * Renders nothing; purely an effect component.
 */
export function SessionWatcher() {
  const router = useRouter()
  const expiredRef = useRef(false)
  const [expired, setExpired] = useState(false)

  const expireSession = useCallback(() => {
    if (expiredRef.current) return
    expiredRef.current = true
    setExpired(true)
    void clearPrivateOfflineData()
    const nextPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
    router.replace(`/sign-out?next=${encodeURIComponent(nextPath)}` as Route)
  }, [router])

  const checkSession = useCallback(async () => {
    if (document.visibilityState !== "visible") return false

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
    }
  }, [expireSession])

  useEffect(() => {
    const events = new EventSource("/api/session/events")
    const onSessionsChanged = () => {
      void checkSession().then((active) => {
        if (active) {
          window.dispatchEvent(new Event(ACTIVE_SESSIONS_CHANGED_EVENT))
        }
      })
    }
    events.addEventListener("sessions-changed", onSessionsChanged)
    events.onerror = () => {
      void checkSession()
    }

    void checkSession()

    // Also probe immediately when the user switches back to this tab.
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void checkSession()
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      events.close()
      document.removeEventListener("visibilitychange", onVisibilityChange)
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
