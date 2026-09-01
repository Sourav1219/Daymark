"use client"

import { useActionState, useEffect, useState } from "react"
import { CheckCircle2, LockKeyhole, Mail, UserRound } from "lucide-react"

import { MutationSubmitButton } from "@/components/system/mutation-submit-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateProfileNameAction } from "@/features/authentication/application/account-actions"
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
      <ProfileNamePanel email={email} name={name} onUpdated={onUpdated} />
    </div>
  )
}

function ProfileNamePanel({
  email,
  name,
  onUpdated,
}: Readonly<{
  email: string
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

        <div className="profile-edit-field">
          <Label>Email address</Label>
          <div className="profile-edit-email">
            <span>
              <Mail aria-hidden="true" />
            </span>
            <div>
              <small>Sign-in identity</small>
              <strong>{email}</strong>
            </div>
            <span className="profile-edit-email__lock">
              <LockKeyhole aria-hidden="true" /> Locked
            </span>
          </div>
          <p className="profile-edit-help">
            Email changes are disabled to protect your account identity.
          </p>
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
