import type { Metadata } from "next"

import { UnauthorizedClient } from "@/app/unauthorized-client"

export const metadata: Metadata = {
  title: "Sign In Required",
  description: "Sign in to access this page.",
}

/**
 * Next.js special boundary rendered automatically when any server component
 * or server action calls `unauthorized()` from `next/navigation`.
 *
 * This is NOT a page users navigate to intentionally. It is an intercept
 * boundary — Next.js keeps the original protected URL in the browser bar and
 * renders this UI in place of the blocked content. The UnauthorizedClient
 * component reads `window.location` to forward the original URL as the
 * post-sign-in redirect target.
 */
export default function Unauthorized() {
  return <UnauthorizedClient />
}
