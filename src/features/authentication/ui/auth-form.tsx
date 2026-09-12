"use client"

import { useActionState, useEffect, useRef, useState } from "react"
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
import { TurnstileWidget } from "@/features/authentication/ui/turnstile-widget"
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
  skipEntranceAnimation?: boolean
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
  skipEntranceAnimation = false,
}: AuthFormProps) {
  const registering = mode === "register"
  const [state, formAction, pending] = useActionState(
    registering ? registerAction : loginAction,
    null,
  )
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyNoticeAcknowledged, setPrivacyNoticeAcknowledged] =
    useState(false)
  const [agreementReviewRequested, setAgreementReviewRequested] =
    useState(false)
  const agreementsRef = useRef<HTMLDivElement>(null)
  const termsCheckboxRef = useRef<HTMLInputElement>(null)
  const privacyCheckboxRef = useRef<HTMLInputElement>(null)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const turnstileSiteKey =
    process.env.NEXT_PUBLIC_E2E_TEST_MODE === "true"
      ? ""
      : (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "")
  const [captchaVerified, setCaptchaVerified] = useState(!turnstileSiteKey)
  const [messageIndex, setMessageIndex] = useState(0)
  const fieldErrors = state && !state.ok ? state.error.fieldErrors : undefined
  const noticeMessage =
    notice === "verification-error"
      ? "That verification request is invalid or expired. Request a new code below."
      : null
  const verificationEmail =
    registering && state?.ok && state.data.verificationRequired
      ? (state.data.email ?? email)
      : null
  const registrationAgreementsAccepted =
    termsAccepted && privacyNoticeAcknowledged
  const agreementPromptVisible =
    registering && agreementReviewRequested && !registrationAgreementsAccepted

  useEffect(() => {
    if (!pending) {
      return
    }

    const timer = window.setInterval(() => {
      setMessageIndex((index) => (index + 1) % loadingMessages.length)
    }, 700)

    return () => window.clearInterval(timer)
  }, [pending])

  function switchMode(nextMode: "login" | "register") {
    if (nextMode === "login") setAgreementReviewRequested(false)
    onSwitchMode?.(nextMode)
  }

  function requestRegistrationAgreementReview() {
    setAgreementReviewRequested(true)
    agreementsRef.current?.scrollIntoView?.({
      behavior: "smooth",
      block: "center",
    })
    const firstUncheckedCheckbox = termsAccepted
      ? privacyCheckboxRef.current
      : termsCheckboxRef.current
    firstUncheckedCheckbox?.focus({ preventScroll: true })
  }

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
      <div
        className={
          skipEntranceAnimation
            ? "auth__inner auth__inner--instant"
            : "auth__inner"
        }
      >
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
          <h2 className="auth__subtitle">
            {registering
              ? "Turn your intentions into finished tasks."
              : "Your tasks are waiting for you."}
          </h2>
        </div>

        <div className="auth__tabs">
          <button
            aria-pressed={!registering}
            className="auth__tab"
            data-active={!registering}
            onClick={() => switchMode("login")}
            type="button"
          >
            Sign in
          </button>
          <button
            aria-pressed={registering}
            className="auth__tab"
            data-active={registering}
            onClick={() => switchMode("register")}
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
          registrationAllowed={registrationAgreementsAccepted}
          onRegistrationAgreementRequired={requestRegistrationAgreementReview}
        />

        <div className="auth__divider" role="separator">
          <span>or continue with email</span>
        </div>

        {noticeMessage ? (
          <div className="auth__error" role="alert">
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
          onSubmit={() => setMessageIndex(0)}
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
                minLength={registering ? 12 : undefined}
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
                Must be at least 12 characters.
              </p>
            ) : null}
            <FieldError id="password-error" messages={fieldErrors?.password} />
          </div>

          {turnstileSiteKey ? (
            <TurnstileWidget
              onVerifiedChange={setCaptchaVerified}
              resetSignal={state}
              siteKey={turnstileSiteKey}
            />
          ) : null}

          {registering ? (
            <div
              className={
                agreementPromptVisible
                  ? "auth__agreements auth__agreements--error"
                  : "auth__agreements"
              }
              ref={agreementsRef}
            >
              <label className="auth__agreement" htmlFor="termsAccepted">
                <input
                  aria-describedby={
                    [
                      fieldErrors?.termsAccepted ? "termsAccepted-error" : null,
                      agreementPromptVisible
                        ? "registration-agreement-prompt"
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                  aria-invalid={Boolean(
                    fieldErrors?.termsAccepted || agreementPromptVisible,
                  )}
                  checked={termsAccepted}
                  disabled={pending}
                  id="termsAccepted"
                  name="termsAccepted"
                  onChange={(event) => {
                    const accepted = event.target.checked
                    setTermsAccepted(accepted)
                    if (accepted && privacyNoticeAcknowledged) {
                      setAgreementReviewRequested(false)
                    }
                  }}
                  ref={termsCheckboxRef}
                  required
                  type="checkbox"
                />
                <span>
                  I confirm I am 18 or older and accept the{" "}
                  <Link href="/terms">Terms of Service</Link>.
                </span>
              </label>
              <FieldError
                id="termsAccepted-error"
                messages={fieldErrors?.termsAccepted}
              />

              <label
                className="auth__agreement"
                htmlFor="privacyNoticeAcknowledged"
              >
                <input
                  aria-describedby={
                    [
                      fieldErrors?.privacyNoticeAcknowledged
                        ? "privacyNoticeAcknowledged-error"
                        : null,
                      agreementPromptVisible
                        ? "registration-agreement-prompt"
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                  aria-invalid={Boolean(
                    fieldErrors?.privacyNoticeAcknowledged ||
                    agreementPromptVisible,
                  )}
                  checked={privacyNoticeAcknowledged}
                  disabled={pending}
                  id="privacyNoticeAcknowledged"
                  name="privacyNoticeAcknowledged"
                  onChange={(event) => {
                    const acknowledged = event.target.checked
                    setPrivacyNoticeAcknowledged(acknowledged)
                    if (acknowledged && termsAccepted) {
                      setAgreementReviewRequested(false)
                    }
                  }}
                  ref={privacyCheckboxRef}
                  required
                  type="checkbox"
                />
                <span>
                  I have read the <Link href="/privacy">Privacy Notice</Link>,
                  including how my account and task data are used.
                </span>
              </label>
              <FieldError
                id="privacyNoticeAcknowledged-error"
                messages={fieldErrors?.privacyNoticeAcknowledged}
              />
              {agreementPromptVisible ? (
                <p
                  className="auth__agreement-prompt"
                  id="registration-agreement-prompt"
                  role="alert"
                >
                  Please review and accept the terms to continue.
                </p>
              ) : null}
            </div>
          ) : null}

          {state ? (
            <div
              className={state.ok ? "auth__hint" : "auth__error"}
              role={state.ok ? "status" : "alert"}
            >
              {state.ok ? state.data.message : state.error.message}
            </div>
          ) : null}

          <button
            className="auth__submit"
            disabled={
              pending ||
              !captchaVerified ||
              (registering && !registrationAgreementsAccepted)
            }
            type="submit"
          >
            {pending
              ? loadingMessages[messageIndex]
              : registering
                ? "Create"
                : "Enter"}
          </button>
          {!registering ? (
            <div className="auth__help-footer">
              <span>Having trouble signing in?</span>{" "}
              <Link className="auth__help-link" href="/contact">
                Contact us
              </Link>
            </div>
          ) : null}
        </form>
      </div>
    </main>
  )
}
