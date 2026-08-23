import type { Metadata } from "next"

import { safeRedirectPath } from "@/features/authentication/application/validation"
import { isGoogleAuthConfigured } from "@/features/authentication/server/google-auth"
import { AuthExperience } from "@/features/authentication/ui/auth-experience"

export const metadata: Metadata = { title: "Sign in" }

type SignInPageProps = Readonly<{
  searchParams: Promise<{
    authError?: string | string[]
    error?: string | string[]
    next?: string | string[]
    passwordReset?: string | string[]
    verified?: string | string[]
  }>
}>

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { authError, error, next, passwordReset, verified } = await searchParams
  const nextPath = safeRedirectPath(
    Array.isArray(next) ? (next[0] ?? null) : (next ?? null),
  )
  const hasGoogleError =
    (Array.isArray(authError) ? authError[0] : authError) === "google"
  const oauthError = hasGoogleError
    ? (Array.isArray(error) ? error[0] : error) === "signup_disabled"
      ? "signup-required"
      : "generic"
    : null
  const verificationError = Array.isArray(error) ? error[0] : error
  const notice =
    !hasGoogleError &&
    (verificationError === "INVALID_TOKEN" ||
      verificationError === "TOKEN_EXPIRED")
      ? "verification-error"
      : (Array.isArray(passwordReset) ? passwordReset[0] : passwordReset) ===
          "1"
        ? "password-reset"
        : (Array.isArray(verified) ? verified[0] : verified) === "1"
          ? "verified"
          : null

  return (
    <AuthExperience
      googleAuthConfigured={isGoogleAuthConfigured()}
      initial={oauthError || notice ? "login" : "welcome"}
      nextPath={nextPath}
      notice={notice}
      oauthError={oauthError}
    />
  )
}
