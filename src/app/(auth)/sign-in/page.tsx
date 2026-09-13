import { getSessionCookie } from "better-auth/cookies"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { safeRedirectPath } from "@/features/authentication/application/validation"
import { AUTH_COOKIE_PREFIX } from "@/features/authentication/config"
import { isGoogleAuthConfigured } from "@/features/authentication/server/google-auth"
import { AuthExperience } from "@/features/authentication/ui/auth-experience"

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to your Traketo account to access your tasks and focus timer.",
  alternates: { canonical: "/sign-in" },
}

type SignInPageProps = Readonly<{
  searchParams: Promise<{
    authError?: string | string[]
    error?: string | string[]
    mode?: string | string[]
    next?: string | string[]
  }>
}>

async function getCurrentUserWhenSessionCookieExists() {
  const requestHeaders = await headers()
  const sessionToken = getSessionCookie(requestHeaders, {
    cookiePrefix: AUTH_COOKIE_PREFIX,
  })

  // Anonymous visitors are the overwhelmingly common path for this page.
  // Avoid initializing Better Auth and the database client when there is no
  // session to validate; authenticated and stale-cookie visits still perform
  // the authoritative session lookup below.
  if (!sessionToken) return null

  const { getCurrentUser } =
    await import("@/features/authentication/server/authorization")
  return getCurrentUser()
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { authError, error, mode, next } = await searchParams
  const nextPath = safeRedirectPath(
    Array.isArray(next) ? (next[0] ?? null) : (next ?? null),
  )

  const user = await getCurrentUserWhenSessionCookieExists()
  if (user) {
    redirect(nextPath)
  }
  const hasGoogleError =
    (Array.isArray(authError) ? authError[0] : authError) === "google"
  const oauthError = hasGoogleError
    ? (Array.isArray(error) ? error[0] : error) === "signup_disabled"
      ? "signup-required"
      : "generic"
    : null
  const verificationError = Array.isArray(error) ? error[0] : error
  const requestedMode = Array.isArray(mode) ? mode[0] : mode
  const notice =
    !hasGoogleError &&
    (verificationError === "INVALID_TOKEN" ||
      verificationError === "TOKEN_EXPIRED")
      ? "verification-error"
      : null

  return (
    <AuthExperience
      googleAuthConfigured={isGoogleAuthConfigured()}
      initial={
        requestedMode === "login" || oauthError || notice ? "login" : "welcome"
      }
      skipEntranceAnimation={requestedMode === "login"}
      nextPath={nextPath}
      notice={notice}
      oauthError={oauthError}
    />
  )
}
