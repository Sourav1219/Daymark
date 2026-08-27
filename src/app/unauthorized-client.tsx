"use client"

import { useEffect } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"

import { SessionExpiredCard } from "@/features/authentication/ui/session-expired-card"

/**
 * Client boundary rendered by Next.js when any server component calls
 * `unauthorized()` (i.e. no valid session was found for a protected route).
 *
 * Behaviour:
 * - Desktop (≥641 px): immediately replaces the current route with
 *   /sign-in?next=<current-url> so the user lands on the sign-in form
 *   without seeing an extra interstitial screen. The app-shell
 *   SessionWatcher overlay already handles the in-app expired case.
 * - Mobile (≤640 px): renders the full-screen SessionExpiredCard so the
 *   user gets a clear, touch-friendly prompt to re-authenticate.
 *
 * `nextPath` is intentionally left undefined here so that the card's
 * `handleSignIn` reads `window.location` at click time — which is the
 *  original protected URL the user was trying to reach, not "/unauthorized".
 */
export function UnauthorizedClient() {
  const router = useRouter()

  useEffect(() => {
    const isDesktop = window.matchMedia("(min-width: 641px)").matches
    if (isDesktop) {
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
      router.replace(
        `/sign-in?next=${encodeURIComponent(current)}` as Route,
      )
    }
  }, [router])

  return (
    <SessionExpiredCard
      eyebrow="401 · Authentication Required"
      heading="Sign in to continue."
      description="This page requires authentication. Sign in to pick up right where you left off — your tasks and progress remain completely safe."
    />
  )
}
