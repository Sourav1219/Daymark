"use client"

import { ErrorState } from "@/components/system/error-state"

/**
 * Root error boundary.
 *
 * `(system)` owns its own boundary, but `(auth)` and `(legal)` previously had
 * none — a render failure there fell through to `global-error.tsx`, which
 * replaces the entire document (no layout, no styling, no navigation). This
 * boundary keeps a recoverable failure inside the app shell.
 */
export default function RootError({ reset }: { reset: () => void }) {
  return <ErrorState onRetry={reset} />
}
