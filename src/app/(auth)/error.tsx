"use client"

import { ErrorState } from "@/components/system/error-state"

/**
 * Authentication group error boundary.
 *
 * Sign-in, sign-up, verification and password reset are the entry points to
 * the product. Without a boundary here a thrown render error (for example a
 * database hiccup while resolving a reset token) replaced the whole document
 * with the bare global recovery page.
 */
export default function AuthError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      description="The authentication service could not be reached. Your data has not been changed."
      onRetry={reset}
      title="We could not load this page"
    />
  )
}
