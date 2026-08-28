"use client"

import { SessionExpiredCard } from "@/features/authentication/ui/session-expired-card"

type SignOutPageClientProps = Readonly<{
  nextPath: string
}>

/**
 * Client shell for /sign-out.
 *
 * Always shows the SessionExpiredCard — on every viewport.
 * The user stays on this page until they actively click "Sign in again".
 * No auto-redirect occurs; navigation is purely user-initiated.
 */
export function SignOutPageClient({ nextPath }: SignOutPageClientProps) {
  return (
    <SessionExpiredCard
      description="This device was signed out from another active session. Your data remains safe—sign in again whenever you are ready."
      heading="This device has been signed out."
      nextPath={nextPath}
    />
  )
}
