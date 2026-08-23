import type { Metadata } from "next"
import Link from "next/link"

import { PasswordResetForm } from "@/features/authentication/ui/password-reset-form"
import { isPasswordResetTokenActive } from "@/features/authentication/repositories/password-reset-repository"

export const metadata: Metadata = { title: "Reset password" }

type ResetPasswordPageProps = Readonly<{
  searchParams: Promise<{
    error?: string | string[]
    token?: string | string[]
  }>
}>

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { error, token } = await searchParams
  const resetToken = Array.isArray(token) ? token[0] : token
  const resetError = Array.isArray(error) ? error[0] : error
  const active = resetToken
    ? await isPasswordResetTokenActive(resetToken)
    : false

  if (!resetToken || resetError || !active) {
    return (
      <main className="auth" data-mode="recovery">
        <div className="auth__inner auth__inner--compact">
          <div className="auth__head">
            <h1 className="auth__title">
              Link no longer
              <br />
              <span>works.</span>
            </h1>
            <p className="auth__subtitle">
              This password-reset link is invalid, expired, or has already been
              used.
            </p>
          </div>
          <Link
            className="auth__submit auth__submit--link"
            href="/forgot-password"
          >
            Request a new link
          </Link>
          <Link className="auth__back-link" href="/sign-in">
            Back to sign in
          </Link>
        </div>
      </main>
    )
  }

  return <PasswordResetForm token={resetToken} />
}
