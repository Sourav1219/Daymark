"use client"

import { useCallback, useEffect, useRef } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"

const navigationShortcuts = new Map<string, Route>([
  ["t", "/today"],
  ["q", "/quests"],
  ["g", "/gates"],
  ["l", "/labels"],
  ["c", "/cleared"],
])

function isEditingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

export function ShellKeyboardShortcuts() {
  const router = useRouter()
  const awaitingNavigation = useRef(false)
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useCallback((href: Route) => router.push(href), [router])

  useEffect(() => {
    document.documentElement.dataset.shortcutsReady = "true"

    function handleShortcut(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        isEditingTarget(event.target) ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return
      }

      const key = event.key.toLowerCase()

      if (key === "n") {
        event.preventDefault()
        navigate("/quests#create-quest-title")
        return
      }

      if (awaitingNavigation.current) {
        awaitingNavigation.current = false
        if (navigationTimer.current) clearTimeout(navigationTimer.current)
        const href = navigationShortcuts.get(key)
        if (href) {
          event.preventDefault()
          navigate(href)
        }
        return
      }

      if (key === "g") {
        awaitingNavigation.current = true
        navigationTimer.current = setTimeout(() => {
          awaitingNavigation.current = false
        }, 900)
      }
    }

    window.addEventListener("keydown", handleShortcut)
    return () => {
      window.removeEventListener("keydown", handleShortcut)
      delete document.documentElement.dataset.shortcutsReady
      if (navigationTimer.current) clearTimeout(navigationTimer.current)
    }
  }, [navigate])

  return null
}
