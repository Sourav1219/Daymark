"use client"

import Link from "next/link"
import { MailCheck, RefreshCw, ShieldCheck } from "lucide-react"
import { useActionState, useState } from "react"

import {
  resendVerificationAction,
  verifyEmailCodeAction,
} from "@/features/authentication/application/actions"

type EmailVerificationPanelProps = Readonly<{
  email: string
  onUseAnotherEmail?: () => void
}>

export function EmailVerificationPanel({
  email,
  onUseAnotherEmail,
}: EmailVerificationPanelProps) {
  const [verificationState, verifyAction, verifying] = useActionState(
    verifyEmailCodeAction,
    null,
  )
  const [resendState, resendAction, resending] = useActionState(
    resendVerificationAction,
    null,
  )
  const [code, setCode] = useState("")
  const codeErrors =
    verificationState && !verificationState.ok
      ? verificationState.error.fieldErrors?.code
      : undefined
  const busy = verifying || resending

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
            <p className="verification__expiry" id="verification-code-hint">
              <ShieldCheck aria-hidden="true" /> Expires in 10 minutes · 5
              attempts
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
          disabled={busy || code.length !== 6}
          type="submit"
        >
          {verifying ? "Verifying…" : "Verify email"}
        </button>
      </form>

      <div className="verification__resend">
        <div>
          <strong>Didn’t receive it?</strong>
          <span>Check spam, or send a fresh code.</span>
        </div>
        <form action={resendAction}>
          <input name="email" type="hidden" value={email} />
          <button
            className="verification__resend-button"
            disabled={busy}
            type="submit"
          >
            <RefreshCw aria-hidden="true" />
            {resending ? "Sending…" : "Resend code"}
          </button>
        </form>
      </div>

      {resendState ? (
        <div
          className={resendState.ok ? "auth__success" : "auth__error"}
          role={resendState.ok ? "status" : "alert"}
        >
          {resendState.ok
            ? resendState.data.message
            : resendState.error.message}
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
        <Link href="/sign-in">Back to sign in</Link>
      </div>
    </section>
  )
}
