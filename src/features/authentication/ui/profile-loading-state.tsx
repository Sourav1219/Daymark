import {
  BadgeCheck,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  LogOut,
  Mail,
  Pencil,
  ShieldCheck,
  UserRound,
} from "lucide-react"

import { LoadingPlaceholder } from "@/components/system/loading-placeholder"

export function ProfileLoadingState() {
  return (
    <div
      aria-label="Loading Your profile"
      className="profile-page exact-route-loading"
      role="status"
    >
      <span className="sr-only">Loading Your profile</span>
      <header className="profile-header">
        <div>
          <span>Account</span>
          <h1>Your profile</h1>
          <p>Your personal details in one simple place.</p>
        </div>
        <button className="profile-edit-trigger" disabled type="button">
          <Pencil /> <span>Edit profile</span>
        </button>
      </header>

      <section aria-hidden="true" className="profile-hero">
        <span className="profile-hero__glow profile-hero__glow--one" />
        <span className="profile-hero__glow profile-hero__glow--two" />
        <div className="profile-hero__topline">
          <span className="profile-hero__workspace">
            <Building2 />
            <LoadingPlaceholder className="exact-loading__workspace" />
          </span>
          <span className="profile-hero__status">
            <BadgeCheck /> Active
          </span>
        </div>
        <div className="profile-hero__identity">
          <div className="profile-hero__avatar-wrap">
            <div className="profile-hero__avatar">
              <LoadingPlaceholder className="exact-loading__avatar" />
            </div>
            <span className="profile-hero__verified">
              <BadgeCheck />
            </span>
          </div>
          <div className="profile-hero__copy">
            <span>
              <LoadingPlaceholder className="exact-loading__role" /> account
            </span>
            <h2>
              <LoadingPlaceholder className="exact-loading__profile-name" />
            </h2>
            <p>
              <Mail />
              <LoadingPlaceholder className="exact-loading__email" />
            </p>
          </div>
        </div>
        <div className="profile-hero__meta">
          <div>
            <CalendarDays />
            <span>
              <small>Member since</small>
              <strong>
                <LoadingPlaceholder className="exact-loading__meta-value" />
              </strong>
            </span>
          </div>
          <div>
            <ShieldCheck />
            <span>
              <small>Profile visibility</small>
              <strong>Private to you</strong>
            </span>
          </div>
        </div>
      </section>

      <section aria-hidden="true" className="profile-overview">
        <div className="profile-section-heading">
          <div>
            <span>Profile details</span>
            <h2>About this account</h2>
            <p>Your saved information and workspace access.</p>
          </div>
          <UserRound />
        </div>
        <article className="profile-account-card">
          <dl>
            <ProfileRow icon="user" label="Display name" />
            <ProfileRow icon="mail" label="Email address" />
          </dl>
        </article>
      </section>

      <details aria-hidden="true" className="profile-security-settings">
        <summary className="profile-security-settings__trigger" tabIndex={-1}>
          <span className="profile-security-settings__icon">
            <ShieldCheck />
          </span>
          <div>
            <small>Account settings</small>
            <strong>Security &amp; data</strong>
            <p>Sessions, data export, and account deletion</p>
          </div>
          <span className="profile-security-settings__count">
            <LoadingPlaceholder className="exact-loading__device-count" />{" "}
            devices
          </span>
          <ChevronDown className="profile-security-settings__chevron" />
        </summary>
      </details>

      <details aria-hidden="true" className="profile-help-settings">
        <summary className="profile-help-settings__trigger" tabIndex={-1}>
          <span className="profile-help-settings__icon">
            <CircleHelp />
          </span>
          <div>
            <small>Help &amp; information</small>
            <strong>Contact &amp; about</strong>
            <p>Support, app information, and policies</p>
          </div>
          <ChevronDown className="profile-help-settings__chevron" />
        </summary>
      </details>

      <section aria-hidden="true" className="profile-session-tab">
        <div className="profile-session-tab__intro">
          <span className="profile-session-tab__icon">
            <LogOut />
          </span>
          <div>
            <small>Session</small>
            <strong>Account access</strong>
            <p>Safely leave Traketo on this device.</p>
          </div>
        </div>
        <div className="profile-session-tab__action">
          <LoadingPlaceholder className="exact-loading__session-action" />
        </div>
      </section>
    </div>
  )
}

function ProfileRow({
  icon,
  label,
}: Readonly<{
  icon: "mail" | "user"
  label: string
}>) {
  const Icon = icon === "user" ? UserRound : Mail

  return (
    <div>
      <dt>
        <span className="profile-account-card__icon">
          <Icon />
        </span>
        <span>{label}</span>
      </dt>
      <dd>
        <LoadingPlaceholder className="exact-loading__account-value" />
      </dd>
    </div>
  )
}
