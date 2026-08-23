"use client"

import Link from "next/link"
import { useActionState } from "react"

import {
  requestPasswordResetAction,
  resendVerificationAction,
} from "@/features/authentication/application/actions"

type AccountEmailFormProps = Readonly<{
  mode: "password-reset" | "verification"
}>

export function AccountEmailForm({ mode }: AccountEmailFormProps) {
  const verification = mode === "verification"
  const [state, action, pending] = useActionState(
    verification ? resendVerificationAction : requestPasswordResetAction,
    null,
  )
  const emailErrors =
    state && !state.ok ? state.error.fieldErrors?.email : undefined

  return (
    <main className="auth" data-mode="recovery">
      <div className="auth__inner auth__inner--compact">
        <div className="auth__head">
          <h1 className="auth__title">
            {verification ? "Verify your" : "Reset your"}
            <br />
            <span>{verification ? "email." : "password."}</span>
          </h1>
          <p className="auth__subtitle">
            {verification
              ? "We’ll send a fresh one-time verification link."
              : "We’ll send a secure password-reset link if the account is eligible."}
          </p>
        </div>

        <form action={action} className="auth__form" noValidate>
          <div className="auth__field">
            <label className="auth__label" htmlFor="recovery-email">
              Email
            </label>
            <input
              aria-describedby={
                emailErrors ? "recovery-email-error" : undefined
              }
              aria-invalid={Boolean(emailErrors)}
              autoCapitalize="none"
              autoComplete="email"
              className="auth__input"
              disabled={pending}
              id="recovery-email"
              inputMode="email"
              maxLength={320}
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
            {emailErrors?.[0] ? (
              <p
                className="auth__field-error"
                id="recovery-email-error"
                role="alert"
              >
                {emailErrors[0]}
              </p>
            ) : null}
          </div>

          {state ? (
            <div
              className={state.ok ? "auth__success" : "auth__error"}
              role={state.ok ? "status" : "alert"}
            >
              {state.ok ? state.data.message : state.error.message}
            </div>
          ) : null}

          <button className="auth__submit" disabled={pending} type="submit">
            {pending
              ? "Sending…"
              : verification
                ? "Send verification link"
                : "Send reset link"}
          </button>
        </form>

        <Link className="auth__back-link" href="/sign-in">
          Back to sign in
        </Link>
      </div>
    </main>
  )
}
