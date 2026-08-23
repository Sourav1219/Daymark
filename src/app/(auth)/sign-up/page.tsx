import type { Metadata } from "next"

import { safeRedirectPath } from "@/features/authentication/application/validation"
import { isGoogleAuthConfigured } from "@/features/authentication/server/google-auth"
import { AuthExperience } from "@/features/authentication/ui/auth-experience"

export const metadata: Metadata = { title: "Create account" }

type SignUpPageProps = Readonly<{
  searchParams: Promise<{
    authError?: string | string[]
    next?: string | string[]
  }>
}>

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { authError, next } = await searchParams
  const nextPath = safeRedirectPath(
    Array.isArray(next) ? (next[0] ?? null) : (next ?? null),
  )
  const oauthError =
    (Array.isArray(authError) ? authError[0] : authError) === "google"
      ? "generic"
      : null

  return (
    <AuthExperience
      googleAuthConfigured={isGoogleAuthConfigured()}
      initial="register"
      nextPath={nextPath}
      notice={null}
      oauthError={oauthError}
    />
  )
}
