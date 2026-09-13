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
 * The user stays on this page until they actively click the CTA.
 * No auto-redirect occurs; navigation is purely user-initiated.
 */
export function SignOutPageClient({
  nextPath,
  reason,
}: SignOutPageClientProps) {
  if (reason === "deleted") {
    return (
      <SessionExpiredCard
        actionHref="/sign-up"
        actionLabel="Create a new account"
        badgeLabel="Account Deleted"
        chipLabel="Data Erased"
        description="Your account, workspace, tasks, history, and all connected data have been permanently and irreversibly erased as requested."
        eyebrow="Permanent · Irreversible"
        heading="Your account has been deleted."
        securityNote="This action cannot be undone. If you need a fresh start, create a new account below."
        switchAccountHref="/sign-in"
        switchAccountLabel="sign in with a different account"
        switchAccountText="Still have an account?"
      />
    )
  }

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
