"use client"

import { useActionState, useEffect, useState } from "react"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"

import {
  loginAction,
  registerAction,
} from "@/features/authentication/application/actions"
import {
  type GoogleOAuthError,
  GoogleAuthButton,
} from "@/features/authentication/ui/google-auth-button"
import { EmailVerificationPanel } from "@/features/authentication/ui/email-verification-panel"
import { requestAutomaticPushPermission } from "@/features/reminders/components/automatic-push-enrollment"
import type { AuthNotice } from "@/features/authentication/ui/auth-experience"

const loadingMessages = [
  "Verifying...",
  "Loading profile...",
  "Almost there...",
]

type AuthFormProps = Readonly<{
  googleAuthConfigured: boolean
  mode: "login" | "register"
  nextPath: string
  notice: AuthNotice
  oauthError: GoogleOAuthError
  onSwitchMode?: (mode: "login" | "register") => void
}>

function FieldError({
  id,
  messages,
}: {
  id: string
  messages: readonly string[] | undefined
}) {
  const message = messages?.[0]

  if (!message) {
    return null
  }

  return (
    <p className="auth__field-error" id={id} role="alert">
      {message}
    </p>
  )
}

export function AuthForm({
  googleAuthConfigured,
  mode,
  nextPath,
  notice,
  oauthError,
  onSwitchMode,
}: AuthFormProps) {
  const registering = mode === "register"
  const [state, formAction, pending] = useActionState(
    registering ? registerAction : loginAction,
    null,
  )
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [messageIndex, setMessageIndex] = useState(0)
  const fieldErrors = state && !state.ok ? state.error.fieldErrors : undefined
  const noticeMessage =
    notice === "password-reset"
      ? "Your password was reset. Sign in with your new password."
      : notice === "verification-error"
        ? "That verification request is invalid or expired. Request a new code below."
        : null
  const verificationEmail =
    registering && state?.ok && state.data.verificationRequired
      ? (state.data.email ?? email)
      : null

  useEffect(() => {
    if (!pending) {
      return
    }

    const timer = window.setInterval(() => {
      setMessageIndex((index) => (index + 1) % loadingMessages.length)
    }, 700)

    return () => window.clearInterval(timer)
  }, [pending])

  if (verificationEmail) {
    return (
      <main className="auth" data-mode="verification">
        <div className="auth__inner auth__inner--verification">
          <EmailVerificationPanel
            email={verificationEmail}
            nextPath={nextPath}
            {...(onSwitchMode
              ? { onBackToSignIn: () => onSwitchMode("login") }
              : {})}
          />
        </div>
      </main>
    )
  }

  return (
    <main className="auth" data-mode={mode}>
      <div className="auth__inner">
        <div className="auth__head">
          <h1 className="auth__title">
            {registering ? (
              <>
                Start building
                <br />
                better <span>habits.</span>
              </>
            ) : (
              <>
                Sign in to keep
                <br />
                your <span>streak.</span>
              </>
            )}
          </h1>
          <p className="auth__subtitle">
            {registering
              ? "Turn your intentions into finished tasks."
              : "Your tasks are waiting for you."}
          </p>
        </div>

        <div className="auth__tabs">
          <button
            aria-pressed={!registering}
            className="auth__tab"
            data-active={!registering}
            onClick={() => onSwitchMode?.("login")}
            type="button"
          >
            Sign in
          </button>
          <button
            aria-pressed={registering}
            className="auth__tab"
            data-active={registering}
            onClick={() => onSwitchMode?.("register")}
            type="button"
          >
            Register
          </button>
        </div>

        <GoogleAuthButton
          configured={googleAuthConfigured}
          mode={registering ? "register" : "login"}
          nextPath={nextPath}
          oauthError={oauthError}
        />

        <div className="auth__divider" role="separator">
          <span>or continue with email</span>
        </div>

        {noticeMessage ? (
          <div
            className={
              notice === "verification-error" ? "auth__error" : "auth__success"
            }
            role={notice === "verification-error" ? "alert" : "status"}
          >
            {noticeMessage}
            {notice === "verification-error" ? (
              <Link className="auth__message-link" href="/verify-email">
                Enter verification code
              </Link>
            ) : null}
          </div>
        ) : null}

        <form
          action={formAction}
          className="auth__form"
          noValidate
          onSubmit={(event) => {
            setMessageIndex(0)
            if (registering && event.currentTarget.checkValidity()) {
              requestAutomaticPushPermission()
            }
          }}
        >
          <input name="next" type="hidden" value={nextPath} />

          {registering ? (
            <div className="auth__field">
              <label className="auth__label" htmlFor="name">
                Name
              </label>
              <input
                aria-describedby={fieldErrors?.name ? "name-error" : undefined}
                aria-invalid={Boolean(fieldErrors?.name)}
                autoComplete="name"
                className="auth__input"
                disabled={pending}
                id="name"
                maxLength={120}
                name="name"
                onChange={(event) => setName(event.target.value)}
                placeholder="What should we call you?"
                required
                type="text"
                value={name}
              />
              <FieldError id="name-error" messages={fieldErrors?.name} />
            </div>
          ) : null}

          <div className="auth__field">
            <label className="auth__label" htmlFor="email">
              Email
            </label>
            <input
              aria-describedby={fieldErrors?.email ? "email-error" : undefined}
              aria-invalid={Boolean(fieldErrors?.email)}
              autoCapitalize="none"
              autoComplete="email"
              className="auth__input"
              disabled={pending}
              id="email"
              inputMode="email"
              maxLength={320}
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
            <FieldError id="email-error" messages={fieldErrors?.email} />
          </div>

          <div className="auth__field">
            <div className="auth__field-heading">
              <label className="auth__label" htmlFor="password">
                Password
              </label>
              {!registering ? (
                <Link className="auth__text-link" href="/forgot-password">
                  Forgot password?
                </Link>
              ) : null}
            </div>
            <div className="auth__password-input">
              <input
                aria-describedby={
                  [
                    fieldErrors?.password ? "password-error" : null,
                    registering ? "password-hint" : null,
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                aria-invalid={Boolean(fieldErrors?.password)}
                autoComplete={registering ? "new-password" : "current-password"}
                className="auth__input"
                disabled={pending}
                id="password"
                maxLength={128}
                minLength={registering ? 8 : undefined}
                name="password"
                placeholder="Enter your password"
                required
                type={passwordVisible ? "text" : "password"}
              />
              <button
                aria-controls="password"
                aria-label={passwordVisible ? "Hide password" : "Show password"}
                aria-pressed={passwordVisible}
                className="auth__password-toggle"
                disabled={pending}
                onClick={() => setPasswordVisible((visible) => !visible)}
                title={passwordVisible ? "Hide password" : "Show password"}
                type="button"
              >
                {passwordVisible ? (
                  <EyeOff aria-hidden="true" />
                ) : (
                  <Eye aria-hidden="true" />
                )}
              </button>
            </div>
            {registering ? (
              <p className="auth__hint" id="password-hint">
                Use at least 8 characters locally; production requires 12.
              </p>
            ) : null}
            <FieldError id="password-error" messages={fieldErrors?.password} />
          </div>

          {state ? (
            <div
              className={state.ok ? "auth__hint" : "auth__error"}
              role={state.ok ? "status" : "alert"}
            >
              {state.ok ? state.data.message : state.error.message}
              {!state.ok && !registering ? (
                <Link className="auth__message-link" href="/verify-email">
                  Enter verification code
                </Link>
              ) : null}
            </div>
          ) : null}

          <button className="auth__submit" disabled={pending} type="submit">
            {pending
              ? loadingMessages[messageIndex]
              : registering
                ? "Create"
                : "Enter"}
          </button>
        </form>
      </div>
    </main>
  )
}
