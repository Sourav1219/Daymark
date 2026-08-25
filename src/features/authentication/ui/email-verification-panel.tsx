"use client"

import Link from "next/link"
import { MailCheck, RefreshCw, ShieldCheck } from "lucide-react"
import { useActionState, useCallback, useEffect, useState } from "react"

import {
  type AuthActionState,
  resendVerificationAction,
  verifyEmailCodeAction,
} from "@/features/authentication/application/actions"

type EmailVerificationPanelProps = Readonly<{
  email: string
  nextPath?: string
  onBackToSignIn?: () => void
  onUseAnotherEmail?: () => void
}>

const codeLifetimeSeconds = 10 * 60
const maximumResends = 5

function countdownLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

export function EmailVerificationPanel({
  email,
  nextPath = "/today",
  onBackToSignIn,
  onUseAnotherEmail,
}: EmailVerificationPanelProps) {
  const [code, setCode] = useState("")
  const [secondsRemaining, setSecondsRemaining] = useState(codeLifetimeSeconds)
  const [resendsRemaining, setResendsRemaining] = useState(maximumResends)
  const handleResend = useCallback(
    async (previousState: AuthActionState, formData: FormData) => {
      const nextState = await resendVerificationAction(previousState, formData)
      if (nextState?.ok) {
        setCode("")
        setSecondsRemaining(codeLifetimeSeconds)
        setResendsRemaining((remaining) => Math.max(0, remaining - 1))
      }
      return nextState
    },
    [],
  )
  const [verificationState, verifyAction, verifying] = useActionState(
    verifyEmailCodeAction,
    null,
  )
  const [resendState, resendAction, resending] = useActionState(
    handleResend,
    null,
  )
  const codeErrors =
    verificationState && !verificationState.ok
      ? verificationState.error.fieldErrors?.code
      : undefined
  const busy = verifying || resending
  const expired = secondsRemaining === 0

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsRemaining((seconds) => Math.max(0, seconds - 1))
    }, 1_000)

    return () => window.clearInterval(timer)
  }, [])

  return (
    <section className="verification" aria-labelledby="verification-title">
      <div className="verification__icon" aria-hidden="true">
        <MailCheck />
      </div>

      <div className="verification__heading">
        <p className="verification__eyebrow">One last step</p>
        <h1 className="verification__title" id="verification-title">
          Check your inbox<span>.</span>
        </h1>
        <p className="verification__subtitle">
          We sent a 6-digit verification code to
          <strong>{email}</strong>
        </p>
      </div>

      <form action={verifyAction} className="verification__form" noValidate>
        <input name="email" type="hidden" value={email} />
        <input name="next" type="hidden" value={nextPath} />
        <div className="auth__field">
          <label className="auth__label" htmlFor="verification-code">
            Verification code
          </label>
          <input
            aria-describedby={
              codeErrors ? "verification-code-error" : "verification-code-hint"
            }
            aria-invalid={Boolean(codeErrors)}
            autoComplete="one-time-code"
            autoFocus
            className="verification__code"
            disabled={busy}
            id="verification-code"
            inputMode="numeric"
            maxLength={6}
            name="code"
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/gu, "").slice(0, 6))
            }
            pattern="[0-9]{6}"
            placeholder="000000"
            required
            type="text"
            value={code}
          />
          {codeErrors?.[0] ? (
            <p
              className="auth__field-error"
              id="verification-code-error"
              role="alert"
            >
              {codeErrors[0]}
            </p>
          ) : (
            <p
              className="verification__expiry"
              data-expired={expired}
              id="verification-code-hint"
            >
              <ShieldCheck aria-hidden="true" />
              {expired
                ? "Code expired"
                : `${countdownLabel(secondsRemaining)} remaining`}
              {" · "}
              {resendsRemaining} resend{resendsRemaining === 1 ? "" : "s"} left
            </p>
          )}
        </div>

        {verificationState && !verificationState.ok && !codeErrors ? (
          <div className="auth__error" role="alert">
            {verificationState.error.message}
          </div>
        ) : null}

        <button
          className="auth__submit verification__submit"
          disabled={busy || expired || code.length !== 6}
          type="submit"
        >
          {verifying ? "Verifying…" : "Verify email"}
        </button>
      </form>

      <div className="verification__resend">
        <div>
          <strong>Didn’t receive it?</strong>
          <span role={resendState?.ok ? "status" : undefined}>
            {resendState?.ok
              ? "New code requested. Check your inbox."
              : resendsRemaining === 0
                ? "No resends left in this session."
                : "Check spam, or send a fresh code."}
          </span>
        </div>
        <form action={resendAction}>
          <input name="email" type="hidden" value={email} />
          <button
            className="verification__resend-button"
            disabled={busy || resendsRemaining === 0}
            type="submit"
          >
            <RefreshCw aria-hidden="true" />
            {resending ? "Sending…" : "Resend code"}
          </button>
        </form>
      </div>

      {resendState && !resendState.ok ? (
        <div className="auth__error" role="alert">
          {resendState.error.message}
        </div>
      ) : null}

      <div className="verification__links">
        {onUseAnotherEmail ? (
          <button onClick={onUseAnotherEmail} type="button">
            Use another email
          </button>
        ) : (
          <a href="/sign-up">Use another email</a>
        )}
        <span aria-hidden="true">·</span>
        {onBackToSignIn ? (
          <button onClick={onBackToSignIn} type="button">
            Back to sign in
          </button>
        ) : (
          <Link href="/sign-in">Back to sign in</Link>
        )}
      </div>
    </section>
  )
}
