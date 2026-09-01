import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { safeRedirectPath } from "@/features/authentication/application/validation"
import { getCurrentUser } from "@/features/authentication/server/authorization"
import { isGoogleAuthConfigured } from "@/features/authentication/server/google-auth"
import { AuthExperience } from "@/features/authentication/ui/auth-experience"

export const metadata: Metadata = { title: "Sign in" }

type SignInPageProps = Readonly<{
  searchParams: Promise<{
    authError?: string | string[]
    error?: string | string[]
    mode?: string | string[]
    next?: string | string[]
  }>
}>

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { authError, error, mode, next } = await searchParams
  const nextPath = safeRedirectPath(
    Array.isArray(next) ? (next[0] ?? null) : (next ?? null),
  )

  const user = await getCurrentUser()
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
