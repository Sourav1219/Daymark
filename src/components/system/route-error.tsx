"use client"

import { useEffect } from "react"

import { ErrorState } from "@/components/system/error-state"

export type RouteErrorBoundaryProps = Readonly<{
  error: Error & { digest?: string }
  retry: () => void
}>

export function RouteError({
  error,
  retry,
  routeName,
}: RouteErrorBoundaryProps & Readonly<{ routeName: string }>) {
  useEffect(() => {
    console.error(`${routeName} route failed`, {
      digest: error.digest,
      name: error.name,
    })
  }, [error, routeName])

  return (
    <ErrorState
      description={`${routeName} could not be loaded. Existing data was not changed.`}
      onRetry={retry}
    />
  )
}
