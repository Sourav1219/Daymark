import type { ReactNode } from "react"
import { getSessionCookie } from "better-auth/cookies"
import { headers } from "next/headers"

import { AUTH_COOKIE_PREFIX } from "@/features/authentication/config"
import { LegalShellContext } from "@/components/legal/legal-shell-context"

/**
 * Layout for public legal pages (about, privacy, terms).
 *
 * These pages must be accessible without authentication, so we never call
 * `requireUser()` here.  Instead we do a lightweight cookie sniff to decide
 * where the back-button should point:
 *   – authenticated → /profile  (stay inside the app)
 *   – anonymous     → /sign-in  (return to the entry point)
 */
export default async function LegalLayout({
  children,
}: {
  children: ReactNode
}) {
  const requestHeaders = await headers()
  // Build a minimal Request-like object so getSessionCookie can read the
  // Cookie header without us importing the full auth instance.
  const cookieHeader = requestHeaders.get("cookie") ?? ""
  const fakeRequest = new Request("http://localhost", {
    headers: { cookie: cookieHeader },
  })
  const sessionCookie = getSessionCookie(fakeRequest, {
    cookiePrefix: AUTH_COOKIE_PREFIX,
  })

  const backHref = sessionCookie ? "/profile" : "/sign-in"

  return <LegalShellContext backHref={backHref}>{children}</LegalShellContext>
}
