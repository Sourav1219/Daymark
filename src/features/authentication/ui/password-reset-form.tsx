"use client"

import Link from "next/link"
import { useActionState } from "react"

import { resetPasswordAction } from "@/features/authentication/application/actions"
import { AuthSuccessPopup } from "@/features/authentication/ui/auth-success-popup"

export function PasswordResetForm({ token }: Readonly<{ token: string }>) {
  const [state, action, pending] = useActionState(resetPasswordAction, null)
  const fieldErrors = state && !state.ok ? state.error.fieldErrors : undefined

  return (
    <main className="auth" data-mode="recovery">
      <div className="auth__inner auth__inner--compact">
        <div className="auth__head">
          <h1 className="auth__title">
            Choose a new
            <br />
            <span>password.</span>
          </h1>
          <p className="auth__subtitle">
            This secure link can be used once and expires after one hour.
          </p>
        </div>

        <form action={action} className="auth__form" noValidate>
          <input name="token" type="hidden" value={token} />
          <div className="auth__field">
            <label className="auth__label" htmlFor="new-password">
              New password
            </label>
            <input
              aria-describedby={
                fieldErrors?.newPassword ? "new-password-error" : undefined
              }
              aria-invalid={Boolean(fieldErrors?.newPassword)}
              autoComplete="new-password"
              className="auth__input"
              disabled={pending}
              id="new-password"
              maxLength={128}
              minLength={8}
              name="newPassword"
              required
              type="password"
            />
            {fieldErrors?.newPassword?.[0] ? (
              <p
                className="auth__field-error"
                id="new-password-error"
                role="alert"
              >
                {fieldErrors.newPassword[0]}
              </p>
            ) : null}
          </div>

          <div className="auth__field">
            <label className="auth__label" htmlFor="confirm-password">
              Confirm password
            </label>
            <input
              aria-describedby={
                fieldErrors?.confirmPassword
                  ? "confirm-password-error"
                  : undefined
              }
              aria-invalid={Boolean(fieldErrors?.confirmPassword)}
              autoComplete="new-password"
              className="auth__input"
              disabled={pending}
              id="confirm-password"
              maxLength={128}
              name="confirmPassword"
              required
              type="password"
            />
            {fieldErrors?.confirmPassword?.[0] ? (
              <p
                className="auth__field-error"
                id="confirm-password-error"
                role="alert"
              >
                {fieldErrors.confirmPassword[0]}
              </p>
            ) : null}
          </div>

          {state && !state.ok ? (
            <div className="auth__error" role="alert">
              {state.error.message}
            </div>
          ) : null}

          <button className="auth__submit" disabled={pending} type="submit">
            {pending ? "Updating…" : "Update password"}
          </button>
        </form>

        <Link className="auth__back-link" href="/forgot-password">
          Request a new link
        </Link>
      </div>
      {state?.ok ? (
        <AuthSuccessPopup destination="/sign-in" kind="password-reset" />
      ) : null}
    </main>
  )
}
