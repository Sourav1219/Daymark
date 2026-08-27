"use client"

import { useEffect } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"

import { SessionExpiredCard } from "@/features/authentication/ui/session-expired-card"

type SignOutPageClientProps = Readonly<{
  nextPath: string
}>

/**
 * Client-side shell for the /sign-out page.
 *
 * On desktop (viewport wider than 640 px) the full-page session-expired card
 * is not needed — the SessionWatcher overlay already handles that case inside
 * the app shell. Desktop visitors are redirected straight to /sign-in so they
 * can re-authenticate without an extra tap.
 *
 * On mobile (<= 640 px) the dedicated full-screen SessionExpiredCard is shown
 * because the in-app overlay is not suitable for narrow viewports.
 */
export function SignOutPageClient({ nextPath }: SignOutPageClientProps) {
  const router = useRouter()

  useEffect(() => {
    const isDesktop = window.matchMedia("(min-width: 641px)").matches
    if (isDesktop) {
      router.replace(
        `/sign-in?next=${encodeURIComponent(nextPath)}` as Route,
      )
    }
  }, [nextPath, router])

  return (
    <SessionExpiredCard
      description="This device was signed out from another active session. Your data remains safe—sign in again whenever you are ready."
      heading="This device has been signed out."
      nextPath={nextPath}
    />
  )
}
