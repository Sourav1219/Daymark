"use client"

import Link from "next/link"
import { KeyRound, ShieldCheck } from "lucide-react"
import { useActionState, useState } from "react"

import {
  type TwoFactorActionState,
  verifyTwoFactorAction,
} from "@/features/authentication/application/actions"

type TwoFactorMethod = "totp" | "backup"

type TwoFactorChallengeProps = Readonly<{
  nextPath?: string
}>

type TwoFactorFormProps = Readonly<{
  method: TwoFactorMethod
  nextPath: string
  onChangeMethod: () => void
}>

function TwoFactorForm({
  method,
  nextPath,
  onChangeMethod,
}: TwoFactorFormProps) {
  const [code, setCode] = useState("")
  const [state, action, pending] = useActionState<
    TwoFactorActionState,
    FormData
  >(verifyTwoFactorAction, null)
  const codeErrors = state && !state.ok ? state.error.fieldErrors?.code : null
  const isAuthenticator = method === "totp"

  return (
    <form action={action} className="verification__form" noValidate>
      <input name="method" type="hidden" value={method} />
      <input name="next" type="hidden" value={nextPath} />

      <div className="auth__field">
        <label className="auth__label" htmlFor="two-factor-code">
          {isAuthenticator ? "Authenticator code" : "Recovery code"}
        </label>
        <input
          aria-describedby={codeErrors ? "two-factor-code-error" : undefined}
          aria-invalid={Boolean(codeErrors)}
          autoComplete={isAuthenticator ? "one-time-code" : "off"}
          autoFocus
          className={`verification__code${isAuthenticator ? "" : " verification__code--backup"}`}
          disabled={pending}
          id="two-factor-code"
          inputMode={isAuthenticator ? "numeric" : "text"}
          maxLength={isAuthenticator ? 6 : 64}
          name="code"
          onChange={(event) => {
            const value = isAuthenticator
              ? event.target.value.replace(/\D/gu, "").slice(0, 6)
              : event.target.value.slice(0, 64)
            setCode(value)
          }}
          pattern={isAuthenticator ? "[0-9]{6}" : undefined}
          placeholder={isAuthenticator ? "000000" : "XXXXX-XXXXX"}
          required
          spellCheck={false}
          type="text"
          value={code}
        />
        {codeErrors?.[0] ? (
          <p
            className="auth__field-error"
            id="two-factor-code-error"
            role="alert"
          >
            {codeErrors[0]}
          </p>
        ) : null}
      </div>

      <label className="two-factor__trust">
        <input disabled={pending} name="trustDevice" type="checkbox" />
        <span>
          <strong>Trust this device</strong>
          Skip this step here for up to 30 days.
        </span>
      </label>

      {state && !state.ok && !codeErrors ? (
        <div className="auth__error" role="alert">
          {state.error.message}
        </div>
      ) : null}

      <button
        className="auth__submit verification__submit"
        disabled={pending || (isAuthenticator && code.length !== 6) || !code}
        type="submit"
      >
        {pending ? "Verifying…" : "Continue securely"}
      </button>

      <button
        className="two-factor__alternate"
        disabled={pending}
        onClick={onChangeMethod}
        type="button"
      >
        <KeyRound aria-hidden="true" />
        {isAuthenticator
          ? "Use a recovery code instead"
          : "Use an authenticator code instead"}
      </button>
    </form>
  )
}

export function TwoFactorChallenge({
  nextPath = "/today",
}: TwoFactorChallengeProps) {
  const [method, setMethod] = useState<TwoFactorMethod>("totp")

  return (
    <section className="verification" aria-labelledby="two-factor-title">
      <div className="verification__icon" aria-hidden="true">
        <ShieldCheck />
      </div>

      <div className="verification__heading">
        <p className="verification__eyebrow">Account protected</p>
        <h1 className="verification__title" id="two-factor-title">
          Verify it’s you<span>.</span>
        </h1>
        <p className="verification__subtitle">
          {method === "totp"
            ? "Enter the current 6-digit code from your authenticator app."
            : "Enter one of the recovery codes you saved when enabling two-factor authentication."}
        </p>
      </div>

      <TwoFactorForm
        key={method}
        method={method}
        nextPath={nextPath}
        onChangeMethod={() =>
          setMethod((current) => (current === "totp" ? "backup" : "totp"))
        }
      />

      <div className="verification__links">
        <Link href="/sign-in?mode=login">Back to sign in</Link>
      </div>
    </section>
  )
}
