import type { Metadata, Route } from "next"
import { redirect } from "next/navigation"

import { safeRedirectPath } from "@/features/authentication/application/validation"

export const metadata: Metadata = {
  description: "This session ended and requires authentication to continue.",
  title: "Session Ended",
  robots: {
    index: false,
    follow: false,
  },
}

type SessionExpiredPageProps = Readonly<{
  searchParams: Promise<{ next?: string | string[] }>
}>

export default async function SessionExpiredPage({
  searchParams,
}: SessionExpiredPageProps) {
  const { next } = await searchParams
  const nextPath = safeRedirectPath(
    Array.isArray(next) ? (next[0] ?? null) : (next ?? null),
  )

  redirect(
    `/sign-out?reason=expired&next=${encodeURIComponent(nextPath)}` as Route,
  )
}
