import type { Metadata } from "next"

import { SessionExpiredCard } from "@/features/authentication/ui/session-expired-card"

export const metadata: Metadata = {
  title: "Access Denied",
  description: "This workspace is outside your access boundary.",
}

export default function Forbidden() {
  return (
    <SessionExpiredCard
      actionHref="/today"
      actionLabel="Return to your tasks"
      badgeLabel="Access Denied"
      chipLabel="Boundary Guard"
      description="You do not have authorization to view or manage this workspace. Your own account and personal data remain safe."
      eyebrow="403 · Access Denied"
      heading="This workspace is outside your access boundary."
      securityNote="If you believe you should have access, ask the workspace owner to invite your account."
      switchAccountHref="/sign-out"
      switchAccountLabel="Sign in with another account"
      switchAccountText="Looking for a different account?"
    />
  )
}
