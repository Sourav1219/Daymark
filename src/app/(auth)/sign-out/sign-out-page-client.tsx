"use client"

import { SessionExpiredCard } from "@/features/authentication/ui/session-expired-card"

type SignOutPageClientProps = Readonly<{
  nextPath: string
  reason?: string | null
}>

/**
 * Client shell for /sign-out.
 *
 * Always shows the SessionExpiredCard — on every viewport.
 * The user stays on this page until they actively click "Sign in again".
 * No auto-redirect occurs; navigation is purely user-initiated.
 */
export function SignOutPageClient({
  nextPath,
  reason,
}: SignOutPageClientProps) {
  const isRemoteRevocation =
    reason === "remote" || reason === "expired" || reason === "revoked"

  if (isRemoteRevocation) {
    return (
      <SessionExpiredCard
        badgeLabel="Session Ended"
        chipLabel="Security Protected"
        description="This device was signed out from another active session. Your data remains safe—sign in again whenever you are ready."
        heading="This device has been signed out."
        nextPath={nextPath}
      />
    )
  }

  return (
    <SessionExpiredCard
      badgeLabel="Signed Out"
      chipLabel="Safe & Secure"
      description="You have securely signed out of your account. Your tasks, streaks, and workspace progress remain completely safe."
      eyebrow="Account Session Ended"
      heading="You have been signed out."
      nextPath={nextPath}
      securityNote="Sign in whenever you are ready to continue your quests."
    />
  )
}
