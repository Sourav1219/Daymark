"use client"

import type { MouseEvent } from "react"
import type { Route } from "next"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, CheckCircle2, Lock, Shield, Sparkles } from "lucide-react"

type SessionExpiredCardProps = Readonly<{
  eyebrow?: string
  heading?: string
  description?: string
}>

export function SessionExpiredCard({
  eyebrow = "401 · Authentication Required",
  heading = "Your session is missing or expired.",
  description = "You were signed out, or your previous session has ended for your security. Sign in again to get straight back to your quests and workspace.",
}: SessionExpiredCardProps) {
  const router = useRouter()

  function handleSignIn(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    const nextPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
    router.push(`/sign-in?next=${encodeURIComponent(nextPath)}` as Route)
  }

  return (
    <main className="session-expired" role="main">
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
              href="/"
              title="Traketo Home"
            >
              <span className="session-expired__diamond" aria-hidden="true" />
              <span>Traketo</span>
            </Link>

            <span className="session-expired__badge" role="status">
              <span className="session-expired__dot" aria-hidden="true" />
              <span>Session Ended</span>
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
              <span>Quick Re-auth</span>
            </div>
          </div>

          {/* Semantic Heading & Lede */}
          <div className="session-expired__body">
            <p className="session-expired__eyebrow">{eyebrow}</p>
            <h1 className="session-expired__title" id="unauthorized-title">
              {heading}
            </h1>
            <p className="session-expired__description">{description}</p>
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
              href={"/sign-in?next=%2Ftoday" as Route}
              id="session-reauth-btn"
              onClick={handleSignIn}
            >
              <span>Sign in again</span>
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link className="session-expired__btn-secondary" href="/">
              Back to homepage
            </Link>
          </div>

          {/* Footer Note */}
          <footer className="session-expired__footer">
            <p className="session-expired__switch">
              Using a different account?{" "}
              <Link className="session-expired__link" href="/sign-in">
                Switch account
              </Link>
            </p>
            <p className="session-expired__security-note">
              Sessions end automatically when signed out on another device or
              after inactivity.
            </p>
          </footer>
        </div>
      </section>
    </main>
  )
}
