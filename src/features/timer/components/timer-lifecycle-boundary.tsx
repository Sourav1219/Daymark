"use client"

import { useEffect } from "react"

export const activeTimerStorageKey = "traketo.active-timer-session"
export const legacyActiveTimerStorageKey = "daymark.active-timer-session"

export function TimerLifecycleBoundary() {
  useEffect(() => {
    let stopRequested = false
    const stopActiveTimer = () => {
      if (stopRequested) return
      const sessionId =
        window.sessionStorage.getItem(activeTimerStorageKey) ??
        window.sessionStorage.getItem(legacyActiveTimerStorageKey)
      if (!sessionId) return
      window.sessionStorage.removeItem(legacyActiveTimerStorageKey)
      stopRequested = true

      const payload = JSON.stringify({ sessionId })
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/timer/stop", payload)
        return
      }

      void fetch("/api/timer/stop", {
        body: payload,
        credentials: "same-origin",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        keepalive: true,
        method: "POST",
      })
    }

    window.addEventListener("beforeunload", stopActiveTimer)
    window.addEventListener("pagehide", stopActiveTimer)
    return () => {
      window.removeEventListener("beforeunload", stopActiveTimer)
      window.removeEventListener("pagehide", stopActiveTimer)
    }
  }, [])

  return null
}
