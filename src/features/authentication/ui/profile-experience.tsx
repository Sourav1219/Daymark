"use client"

import { useCallback, useState } from "react"
import type { Route } from "next"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FileText,
  Info,
  LockKeyhole,
  LogOut,
  Mail,
  MessageCircleMore,
  Pencil,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react"

import type { SessionView } from "@/features/authentication/application/account-security-actions"
import { AccountSettingsForms } from "@/features/authentication/ui/account-settings-forms"
import {
  ProfileUpdatePopup,
  type ProfileUpdateKind,
} from "@/features/authentication/ui/profile-update-popup"
import { SecurityDataPanel } from "@/features/authentication/ui/security-data-panel"
import { OfflineLogoutButton } from "@/features/offline/components/offline-logout-button"

type ProfileExperienceProps = Readonly<{
  currentSessionId: string | null
  email: string
  initialSessions: readonly SessionView[]
  joined: string
  name: string
  role: string
  workspaceName: string
}>

const whitespacePattern = /\s+/u
const legacyDemoNamePattern = /^\s*demo\s+hunter\s*$/iu

function initials(name: string): string {
  return name
    .split(whitespacePattern)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
}

export function ProfileExperience({
  currentSessionId,
  email,
  initialSessions,
  joined,
  name,
  role,
  workspaceName,
}: ProfileExperienceProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [updateNotice, setUpdateNotice] = useState<ProfileUpdateKind | null>(
    null,
  )
  const displayName = legacyDemoNamePattern.test(name) ? "Demo User" : name
  const dismissUpdate = useCallback(() => {
    setUpdateNotice(null)
    router.refresh()
  }, [router])

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div>
          <span>Account</span>
          <h1>Your profile</h1>
          <p>Your personal details in one simple place.</p>
        </div>
        <button
          aria-controls="profile-editor"
          aria-expanded={editing}
          className="profile-edit-trigger"
          data-open={editing}
          onClick={() => setEditing((open) => !open)}
          type="button"
        >
          {editing ? <X aria-hidden="true" /> : <Pencil aria-hidden="true" />}
          <span>{editing ? "Close" : "Edit profile"}</span>
        </button>
      </header>

      <section aria-labelledby="profile-name" className="profile-hero">
        <span
          aria-hidden="true"
          className="profile-hero__glow profile-hero__glow--one"
        />
        <span
          aria-hidden="true"
          className="profile-hero__glow profile-hero__glow--two"
        />
        <div className="profile-hero__topline">
          <span className="profile-hero__workspace">
            <Building2 aria-hidden="true" />
            {workspaceName}
          </span>
          <span className="profile-hero__status">
            <BadgeCheck aria-hidden="true" /> Active
          </span>
        </div>
        <div className="profile-hero__identity">
          <div className="profile-hero__avatar-wrap">
            <div className="profile-hero__avatar">{initials(displayName)}</div>
            <span className="profile-hero__verified">
              <BadgeCheck aria-label="Verified account" />
            </span>
          </div>
          <div className="profile-hero__copy">
            <span>{role} account</span>
            <h2 id="profile-name">{displayName}</h2>
            <p>
              <Mail aria-hidden="true" />
              <span>{email}</span>
              <LockKeyhole aria-label="Email cannot be edited" />
            </p>
          </div>
        </div>
        <div className="profile-hero__meta">
          <div>
            <CalendarDays aria-hidden="true" />
            <span>
              <small>Member since</small>
              <strong>{joined}</strong>
            </span>
          </div>
          <div>
            <ShieldCheck aria-hidden="true" />
            <span>
              <small>Profile visibility</small>
              <strong>Private to you</strong>
            </span>
          </div>
        </div>
      </section>

      {editing ? (
        <section
          aria-labelledby="profile-editor-heading"
          className="profile-editor"
          id="profile-editor"
        >
          <div className="profile-section-heading">
            <div>
              <span>Profile settings</span>
              <h2 id="profile-editor-heading">Edit your profile</h2>
              <p>Update your display name or securely change your password.</p>
            </div>
            <Pencil aria-hidden="true" />
          </div>
          <AccountSettingsForms
            email={email}
            name={displayName}
            onUpdated={setUpdateNotice}
          />
        </section>
      ) : (
        <section
          aria-labelledby="profile-overview-heading"
          className="profile-overview"
        >
          <div className="profile-section-heading">
            <div>
              <span>Profile details</span>
              <h2 id="profile-overview-heading">About this account</h2>
              <p>Your saved information and workspace access.</p>
            </div>
            <UserRound aria-hidden="true" />
          </div>

          <article className="profile-account-card">
            <dl>
              <ProfileRow
                icon={UserRound}
                label="Display name"
                value={displayName}
              />
              <ProfileRow icon={Mail} label="Email address" value={email} />
              <ProfileRow
                icon={Building2}
                label="Workspace"
                value={workspaceName}
              />
              <ProfileRow icon={ShieldCheck} label="Access" value={role} />
            </dl>
          </article>
        </section>
      )}
      {updateNotice ? (
        <ProfileUpdatePopup kind={updateNotice} onDismiss={dismissUpdate} />
      ) : null}
      <details className="profile-security-settings">
        <summary className="profile-security-settings__trigger">
          <span className="profile-security-settings__icon">
            <ShieldCheck aria-hidden="true" />
          </span>
          <div>
            <small>Account settings</small>
            <strong>Security &amp; data</strong>
            <p>Sessions, data export, and account deletion</p>
          </div>
          <span className="profile-security-settings__count">
            {initialSessions.length}{" "}
            {initialSessions.length === 1 ? "device" : "devices"}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="profile-security-settings__chevron"
          />
        </summary>
        <div className="profile-security-settings__content">
          <SecurityDataPanel
            currentSessionId={currentSessionId}
            initialSessions={initialSessions}
          />
        </div>
      </details>
      <details className="profile-help-settings">
        <summary className="profile-help-settings__trigger">
          <span className="profile-help-settings__icon">
            <CircleHelp aria-hidden="true" />
          </span>
          <div>
            <small>Help &amp; information</small>
            <strong>Contact &amp; about</strong>
            <p>Support, app information, and policies</p>
          </div>
          <ChevronDown
            aria-hidden="true"
            className="profile-help-settings__chevron"
          />
        </summary>
        <nav
          aria-label="Help and information"
          className="profile-help-settings__content"
        >
          <Link href={"/contact" as Route}>
            <span>
              <MessageCircleMore aria-hidden="true" />
            </span>
            <div>
              <strong>Contact us</strong>
              <small>Choose a topic and send a message</small>
            </div>
            <ChevronRight aria-hidden="true" />
          </Link>
          <Link href={"/about" as Route}>
            <span>
              <Info aria-hidden="true" />
            </span>
            <div>
              <strong>About Traketo</strong>
              <small>Our purpose and approach</small>
            </div>
            <ChevronRight aria-hidden="true" />
          </Link>
          <Link href="/privacy">
            <span>
              <ShieldCheck aria-hidden="true" />
            </span>
            <div>
              <strong>Privacy Policy</strong>
              <small>How your information is handled</small>
            </div>
            <ChevronRight aria-hidden="true" />
          </Link>
          <Link href="/terms">
            <span>
              <FileText aria-hidden="true" />
            </span>
            <div>
              <strong>Terms of Service</strong>
              <small>The ground rules for using Traketo</small>
            </div>
            <ChevronRight aria-hidden="true" />
          </Link>
        </nav>
      </details>
      <section aria-label="Session controls" className="profile-session-tab">
        <div className="profile-session-tab__intro">
          <span className="profile-session-tab__icon">
            <LogOut aria-hidden="true" />
          </span>
          <div>
            <small>Session</small>
            <strong>Account access</strong>
            <p>Safely leave Traketo on this device.</p>
          </div>
        </div>
        <div className="profile-session-tab__action">
          <OfflineLogoutButton />
        </div>
      </section>
    </div>
  )
}

function ProfileRow({
  icon: Icon,
  label,
  value,
}: Readonly<{
  icon: typeof UserRound
  label: string
  value: string
}>) {
  return (
    <div>
      <dt>
        <span className="profile-account-card__icon">
          <Icon aria-hidden="true" />
        </span>
        <span>{label}</span>
      </dt>
      <dd>{value}</dd>
    </div>
  )
}
