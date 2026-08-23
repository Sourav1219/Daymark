"use client"

import { useEffect, useRef, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"

import { confirmOnboardingTimezoneAction } from "@/features/onboarding/application/actions"

function subscribeStatic() {
  return () => undefined
}

function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
}

export function AutomaticTimezone({
  confirmed,
  timezone,
  version,
}: Readonly<{
  confirmed: boolean
  timezone: string
  version: number
}>) {
  const detectedTimezone = useSyncExternalStore(
    subscribeStatic,
    browserTimezone,
    () => "",
  )
  const attempted = useRef<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (
      !detectedTimezone ||
      (confirmed && detectedTimezone === timezone) ||
      attempted.current === detectedTimezone
    ) {
      return
    }

    attempted.current = detectedTimezone
    void confirmOnboardingTimezoneAction({
      expectedVersion: version,
      timezone: detectedTimezone,
    }).then((result) => {
      if (result.ok) router.refresh()
    })
  }, [confirmed, detectedTimezone, router, timezone, version])

  return null
}
