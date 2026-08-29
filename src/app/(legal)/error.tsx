"use client"

import { ErrorState } from "@/components/system/error-state"

/**
 * Legal group error boundary.
 *
 * Privacy, terms and about are public pages. Without a boundary a render
 * failure dropped the visitor onto the bare global recovery page with no
 * navigation back into the app.
 */
export default function LegalError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      description="This page could not be displayed. Nothing you submitted was changed."
      onRetry={reset}
      title="This page is unavailable"
    />
  )
}
