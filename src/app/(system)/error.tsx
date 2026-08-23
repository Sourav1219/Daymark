"use client"

import { ErrorState } from "@/components/system/error-state"

export default function SystemError({ reset }: { reset: () => void }) {
  return <ErrorState onRetry={reset} />
}
