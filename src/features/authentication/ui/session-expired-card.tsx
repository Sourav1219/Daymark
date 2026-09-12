"use client"

import type { MouseEvent } from "react"
import type { Route } from "next"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, CheckCircle2, Lock, Shield, Sparkles } from "lucide-react"

import "@/app/styles/session-expired.css"

type SessionExpiredCardProps = Readonly<{
  actionHref?: Route | string
  actionLabel?: string
  badgeLabel?: string
  chipLabel?: string
  description?: string
  eyebrow?: string
  heading?: string
  nextPath?: string
  securityNote?: string
  switchAccountHref?: Route | string
  switchAccountLabel?: string
  switchAccountText?: string
}>

function reauthenticationPath(destination: string): Route {
  return `/sign-in?mode=login&next=${encodeURIComponent(destination)}` as Route
}

export function SessionExpiredCard({
  actionHref,
  actionLabel = "Sign in again",
  badgeLabel = "Session Ended",
  chipLabel = "Quick Re-auth",
  description = "You were signed out, or your previous session has ended for your security. Sign in again to get straight back to your quests and workspace.",
  eyebrow = "401 · Authentication Required",
  heading = "Your session is missing or expired.",
  nextPath,
  securityNote = "Sessions end automatically when signed out on another device or after inactivity.",
  switchAccountHref,
  switchAccountLabel = "Switch account",
  switchAccountText = "Using a different account?",
}: SessionExpiredCardProps) {
  const router = useRouter()
  const resolvedActionHref =
    (actionHref as Route) ?? reauthenticationPath(nextPath ?? "/today")
  const resolvedSwitchHref =
    (switchAccountHref as Route) ?? reauthenticationPath(nextPath ?? "/today")

  function handleAction(event: MouseEvent<HTMLAnchorElement>) {
    if (actionHref) return
    event.preventDefault()
    const destination =
      nextPath ??
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    router.push(reauthenticationPath(destination))
  }

  return (
    <div className="session-expired">
      <div className="session-expired__backdrop-grid" aria-hidden="true" />

      <section
        aria-labelledby="unauthorized-title"
        className="session-expired__stage"
      >
        <div className="session-expired__inner">
          {/* Top Brand & Status bar */}
          <header className="session-expired__topbar">
            <Link
              className="session-expired__wordmark"
              href="/sign-in"
              title="Traketo Home"
            >
              <span className="session-expired__diamond" aria-hidden="true" />
              <span>Traketo</span>
            </Link>

            <span className="session-expired__badge" role="status">
              <span className="session-expired__dot" aria-hidden="true" />
              <span>{badgeLabel}</span>
            </span>
          </header>

          {/* Glowing Animated Security Insignia */}
          <div className="session-expired__art" aria-hidden="true">
            <div className="session-expired__halo" />
            <div className="session-expired__ring session-expired__ring--outer" />
            <div className="session-expired__ring session-expired__ring--inner" />

            <div className="session-expired__chip session-expired__chip--top">
              <Shield aria-hidden="true" />
              <span>Security Protected</span>
            </div>

            <div className="session-expired__icon-box">
              <Lock aria-hidden="true" />
            </div>

            <div className="session-expired__chip session-expired__chip--bottom">
              <Sparkles aria-hidden="true" />
              <span>{chipLabel}</span>
            </div>
          </div>

          {/* Semantic Heading & Lede */}
          <div className="session-expired__body">
            <p className="session-expired__eyebrow">{eyebrow}</p>
            <h1 className="session-expired__title" id="unauthorized-title">
              {heading}
            </h1>
            <h2 className="session-expired__description">{description}</h2>
          </div>

          {/* Data Safety Reassurance */}
          <div className="session-expired__trust">
            <div className="session-expired__trust-icon" aria-hidden="true">
              <CheckCircle2 />
            </div>
            <span>
              Your tasks, streaks & workspace progress remain completely safe.
            </span>
          </div>

          {/* Action CTAs */}
          <div className="session-expired__actions">
            <Link
              className="session-expired__btn-primary"
              href={resolvedActionHref}
              id="session-reauth-btn"
              onClick={handleAction}
              prefetch
            >
              <span>{actionLabel}</span>
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>

          {/* Footer Note */}
          <footer className="session-expired__footer">
            <p className="session-expired__switch">
              {switchAccountText}{" "}
              <Link
                className="session-expired__link"
                href={resolvedSwitchHref}
                prefetch
              >
                {switchAccountLabel}
              </Link>
            </p>
            {securityNote ? (
              <p className="session-expired__security-note">{securityNote}</p>
            ) : null}
          </footer>
        </div>
      </section>
    </div>
  )
}
