"use client"

import Link from "next/link"
import { Mail } from "lucide-react"
import { useActionState, useCallback, useState } from "react"

import {
  requestPasswordResetAction,
  resendVerificationAction,
} from "@/features/authentication/application/actions"
import { EmailVerificationPanel } from "@/features/authentication/ui/email-verification-panel"
import { AuthSuccessPopup } from "@/features/authentication/ui/auth-success-popup"

type AccountEmailFormProps = Readonly<{
  mode: "password-reset" | "verification"
}>

export function AccountEmailForm({ mode }: AccountEmailFormProps) {
  const verification = mode === "verification"

  if (verification) {
    return <VerificationRequestFlow />
  }

  return <PasswordResetRequest />
}

function VerificationRequestFlow() {
  const [flowKey, setFlowKey] = useState(0)

  return (
    <VerificationRequestStep
      key={flowKey}
      onStartOver={() => setFlowKey((current) => current + 1)}
    />
  )
}

function VerificationRequestStep({
  onStartOver,
}: Readonly<{ onStartOver: () => void }>) {
  const [email, setEmail] = useState("")
  const [state, action, pending] = useActionState(
    resendVerificationAction,
    null,
  )
  const emailErrors =
    state && !state.ok ? state.error.fieldErrors?.email : undefined

  if (state?.ok && state.data.verificationRequired) {
    return (
      <main className="auth" data-mode="verification">
        <div className="auth__inner auth__inner--verification">
          <EmailVerificationPanel
            email={state.data.email ?? email}
            onUseAnotherEmail={onStartOver}
          />
        </div>
      </main>
    )
  }

  return (
    <main className="auth" data-mode="verification-request">
      <div className="auth__inner auth__inner--verification-request">
        <div className="verification-request__icon" aria-hidden="true">
          <Mail />
        </div>
        <div className="auth__head verification-request__heading">
          <p className="verification__eyebrow">Email verification</p>
          <h1 className="auth__title">
            Get a fresh <span>code.</span>
          </h1>
          <p className="auth__subtitle">
            Enter the email you registered with. If the account is eligible,
            we’ll send a new 6-digit code.
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
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
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

          {state && !state.ok ? (
            <div className="auth__error" role="alert">
              {state.error.message}
            </div>
          ) : null}

          <button className="auth__submit" disabled={pending} type="submit">
            {pending ? "Sending…" : "Send verification code"}
          </button>
        </form>

        <Link className="auth__back-link" href="/sign-in">
          Back to sign in
        </Link>
      </div>
    </main>
  )
}

function PasswordResetRequest() {
  const [state, action, pending] = useActionState(
    requestPasswordResetAction,
    null,
  )
  const emailErrors =
    state && !state.ok ? state.error.fieldErrors?.email : undefined
  const [dismissedSuccess, setDismissedSuccess] = useState<typeof state>(null)
  const dismissSuccess = useCallback(() => setDismissedSuccess(state), [state])
  const successVisible = state?.ok && state !== dismissedSuccess

  return (
    <main className="auth" data-mode="recovery">
      <div className="auth__inner auth__inner--compact">
        <div className="auth__head">
          <h1 className="auth__title">
            Reset your
            <br />
            <span>password.</span>
          </h1>
          <p className="auth__subtitle">
            We’ll send a secure password-reset link if the account is eligible.
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

          {state && !state.ok ? (
            <div className="auth__error" role="alert">
              {state.error.message}
            </div>
          ) : null}

          <button className="auth__submit" disabled={pending} type="submit">
            {pending ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <Link className="auth__back-link" href="/sign-in">
          Back to sign in
        </Link>
      </div>
      {state?.ok && successVisible ? (
        <AuthSuccessPopup kind="reset-link" onDismiss={dismissSuccess} />
      ) : null}
    </main>
  )
}
