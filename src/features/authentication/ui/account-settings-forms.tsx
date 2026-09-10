"use client"

import Link from "next/link"
import { useActionState, useCallback, useEffect, useState } from "react"
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  MailCheck,
  ShieldCheck,
  UserRound,
} from "lucide-react"

import { MutationSubmitButton } from "@/components/system/mutation-submit-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  type EmailChangeRequestActionState,
  type EmailChangeVerificationActionState,
  requestEmailChangeAction,
  updateProfileNameAction,
  verifyEmailChangeAction,
} from "@/features/authentication/application/account-actions"
import type { ProfileUpdateKind } from "@/features/authentication/ui/profile-update-popup"

const whitespacePattern = /\s+/u

function initials(name: string): string {
  return name
    .trim()
    .split(whitespacePattern)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
}

function FieldError({
  id,
  messages,
}: Readonly<{ id: string; messages: readonly string[] | undefined }>) {
  const message = messages?.[0]

  return message ? (
    <p className="profile-edit-error" id={id} role="alert">
      {message}
    </p>
  ) : null
}

export function AccountSettingsForms({
  email,
  name,
  onUpdated,
}: Readonly<{
  email: string
  name: string
  onUpdated: (kind: ProfileUpdateKind) => void
}>) {
  return (
    <div className="profile-edit-panels">
      <ProfileNamePanel name={name} onUpdated={onUpdated} />
      <EmailChangePanel currentEmail={email} onUpdated={onUpdated} />
    </div>
  )
}

function ProfileNamePanel({
  name,
  onUpdated,
}: Readonly<{
  name: string
  onUpdated: (kind: ProfileUpdateKind) => void
}>) {
  const [state, action] = useActionState(updateProfileNameAction, null)
  const [draftName, setDraftName] = useState(name)
  const fieldErrors = state && !state.ok ? state.error.fieldErrors : undefined

  useEffect(() => {
    if (state?.ok) onUpdated("name")
  }, [onUpdated, state])

  return (
    <article className="profile-edit-card profile-edit-card--identity">
      <header className="profile-edit-card__header">
        <span className="profile-edit-card__icon">
          <UserRound aria-hidden="true" />
        </span>
        <div>
          <small>Personal information</small>
          <h3>Identity details</h3>
          <p>Control how your name appears across Traketo.</p>
        </div>
      </header>

      <div className="profile-edit-preview" aria-label="Profile preview">
        <span className="profile-edit-preview__avatar">
          {initials(draftName) || initials(name)}
        </span>
        <span>
          <small>Profile preview</small>
          <strong>{draftName.trim() || name}</strong>
        </span>
        <CheckCircle2 aria-label="Active account" />
      </div>

      <form action={action} className="profile-edit-form" noValidate>
        <div className="profile-edit-field">
          <div className="profile-edit-label">
            <Label htmlFor="profile-display-name">Display name</Label>
            <span>{draftName.length}/120</span>
          </div>
          <Input
            aria-describedby={
              fieldErrors?.name
                ? "profile-display-name-error"
                : "profile-display-name-help"
            }
            aria-invalid={Boolean(fieldErrors?.name)}
            autoComplete="name"
            className="profile-edit-input"
            id="profile-display-name"
            maxLength={120}
            minLength={2}
            name="name"
            onChange={(event) => setDraftName(event.target.value)}
            required
            value={draftName}
          />
          <p className="profile-edit-help" id="profile-display-name-help">
            Use the name you want to see in your workspace and activity.
          </p>
          <FieldError
            id="profile-display-name-error"
            messages={fieldErrors?.name}
          />
        </div>

        {state && !state.ok && !state.error.fieldErrors ? (
          <p className="profile-edit-alert" role="alert">
            {state.error.message}
          </p>
        ) : null}

        <footer className="profile-edit-actions">
          <span>Your updated name appears immediately.</span>
          <MutationSubmitButton
            className="profile-edit-submit"
            idleLabel="Save identity"
            pendingLabel="Saving identity"
          />
        </footer>
      </form>
    </article>
  )
}

function EmailChangePanel({
  currentEmail,
  onUpdated,
}: Readonly<{
  currentEmail: string
  onUpdated: (kind: ProfileUpdateKind) => void
}>) {
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const requestEmail = useCallback(
    async (previous: EmailChangeRequestActionState, formData: FormData) => {
      const result = await requestEmailChangeAction(previous, formData)
      if (result?.ok) setPendingEmail(result.data.newEmail)
      return result
    },
    [],
  )
  const verifyEmail = useCallback(
    async (
      previous: EmailChangeVerificationActionState,
      formData: FormData,
    ) => {
      const result = await verifyEmailChangeAction(previous, formData)
      if (result?.ok) {
        setCode("")
        onUpdated("email")
      }
      return result
    },
    [onUpdated],
  )
  const [requestState, requestAction] = useActionState(requestEmail, null)
  const [verificationState, verificationAction] = useActionState(
    verifyEmail,
    null,
  )
  const requestErrors =
    requestState && !requestState.ok
      ? requestState.error.fieldErrors
      : undefined
  const verificationErrors =
    verificationState && !verificationState.ok
      ? verificationState.error.fieldErrors
      : undefined

  return (
    <article className="profile-edit-card profile-edit-card--email">
      <header className="profile-edit-card__header">
        <span className="profile-edit-card__icon">
          <MailCheck aria-hidden="true" />
        </span>
        <div>
          <small>Verified sign-in identity</small>
          <h3>Email address</h3>
          <p>
            Your current email remains active until the new one is verified.
          </p>
        </div>
      </header>

      <div className="profile-edit-email">
        <span>
          <Mail aria-hidden="true" />
        </span>
        <div>
          <small>Current email</small>
          <strong>{currentEmail}</strong>
        </div>
        <span className="profile-edit-email__lock profile-edit-email__lock--verified">
          <ShieldCheck aria-hidden="true" /> Verified
        </span>
      </div>

      {pendingEmail ? (
        <div className="profile-email-change-flow">
          <div className="profile-email-change-status" role="status">
            <MailCheck aria-hidden="true" />
            <span>
              <strong>Check your new inbox</strong>
              <small>We sent a 6-digit code to {pendingEmail}.</small>
            </span>
          </div>
          <form
            action={verificationAction}
            className="profile-edit-form"
            noValidate
          >
            <input name="newEmail" type="hidden" value={pendingEmail} />
            <div className="profile-edit-field">
              <Label htmlFor="profile-email-code">Verification code</Label>
              <input
                aria-describedby="profile-email-code-help"
                aria-invalid={Boolean(verificationErrors?.code)}
                autoComplete="one-time-code"
                className="profile-edit-input profile-email-code"
                id="profile-email-code"
                inputMode="numeric"
                maxLength={6}
                name="code"
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/gu, "").slice(0, 6))
                }
                pattern="[0-9]{6}"
                placeholder="000000"
                required
                value={code}
              />
              <p className="profile-edit-help" id="profile-email-code-help">
                The code expires in 10 minutes and can be used once.
              </p>
              <FieldError
                id="profile-email-code-error"
                messages={verificationErrors?.code}
              />
            </div>
            {verificationState &&
            !verificationState.ok &&
            !verificationState.error.fieldErrors ? (
              <p className="profile-edit-alert" role="alert">
                {verificationState.error.message}
              </p>
            ) : null}
            <footer className="profile-edit-actions">
              <button
                className="profile-email-change-link"
                onClick={() => {
                  setPendingEmail(null)
                  setCode("")
                }}
                type="button"
              >
                Use a different email
              </button>
              <MutationSubmitButton
                className="profile-edit-submit profile-edit-submit--email"
                disabled={code.length !== 6}
                idleLabel="Verify and update"
                pendingLabel="Verifying"
              />
            </footer>
          </form>
          <form action={requestAction} className="profile-email-resend">
            <input name="newEmail" type="hidden" value={pendingEmail} />
            <span>Didn’t receive it?</span>
            <MutationSubmitButton
              className="profile-email-resend__button"
              idleLabel="Resend code"
              pendingLabel="Sending"
            />
          </form>
        </div>
      ) : (
        <form action={requestAction} className="profile-edit-form" noValidate>
          <div className="profile-edit-field">
            <Label htmlFor="profile-new-email">New email address</Label>
            <Input
              aria-describedby="profile-new-email-help"
              aria-invalid={Boolean(requestErrors?.newEmail)}
              autoComplete="email"
              className="profile-edit-input"
              id="profile-new-email"
              name="newEmail"
              placeholder="name@example.com"
              required
              type="email"
            />
            <p className="profile-edit-help" id="profile-new-email-help">
              We will send a verification code before changing your sign-in.
            </p>
            <FieldError
              id="profile-new-email-error"
              messages={requestErrors?.newEmail}
            />
          </div>
          {requestState &&
          !requestState.ok &&
          !requestState.error.fieldErrors ? (
            <p className="profile-edit-alert" role="alert">
              {requestState.error.message}
            </p>
          ) : null}
          <footer className="profile-edit-actions">
            <Link
              className="profile-email-correction-link"
              href="/privacy?tab=rights&request=correction"
            >
              Request another correction <ArrowRight aria-hidden="true" />
            </Link>
            <MutationSubmitButton
              className="profile-edit-submit profile-edit-submit--email"
              idleLabel="Send verification code"
              pendingLabel="Sending code"
            />
          </footer>
        </form>
      )}
    </article>
  )
}
