"use client"

import { useEffect } from "react"
import type { Route } from "next"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, CheckCircle2, Lock, ShieldAlert, Zap } from "lucide-react"

/**
 * Client boundary rendered by Next.js when any server component calls
 * `unauthorized()` — i.e. the user hit a protected route without a session.
 *
 * Behaviour
 * ─────────
 * Desktop (≥641 px): immediately replaces the current route with
 *   /sign-in?next=<original-url> — no interstitial, users go straight
 *   to the sign-in form. The in-app SessionWatcher handles expired-session
 *   overlays at this width.
 * Mobile (≤640 px): renders the full-screen dark unauthorized card so
 *   the user gets a clear, touch-friendly prompt to sign in.
 *
 * The original protected URL is captured from window.location so the
 * post-sign-in redirect lands exactly where the user intended to go.
 */
export function UnauthorizedClient() {
  const router = useRouter()

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 641px)")
    if (mq.matches) {
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
      router.replace(`/sign-in?next=${encodeURIComponent(current)}` as Route)
    }
  }, [router])

  function buildSignInHref() {
    if (typeof window === "undefined") return "/sign-in?next=%2Ftoday"
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
    return `/sign-in?next=${encodeURIComponent(current)}`
  }

  return (
    <main className="unauth" role="main">
      {/* Decorative layers */}
      <div className="unauth__grid" aria-hidden="true" />
      <div className="unauth__orb" aria-hidden="true" />

      {/* Top bar */}
      <header className="unauth__topbar">
        <Link className="unauth__wordmark" href="/" title="Traketo Home">
          <span className="unauth__diamond" aria-hidden="true" />
          <span>Traketo</span>
        </Link>

        <span className="unauth__status-pill" role="status">
          <span className="unauth__status-dot" aria-hidden="true" />
          <span>Auth Required</span>
        </span>
      </header>

      {/* Artwork */}
      <div className="unauth__art" aria-hidden="true">
        <div className="unauth__ring" />
        <div className="unauth__ring unauth__ring--inner" />

        <div className="unauth__chip unauth__chip--tl">
          <ShieldAlert aria-hidden="true" />
          <span>Protected</span>
        </div>

        <div className="unauth__icon-box">
          <Lock aria-hidden="true" />
        </div>

        <div className="unauth__chip unauth__chip--br">
          <Zap aria-hidden="true" />
          <span>Quick Login</span>
        </div>
      </div>

      {/* Copy */}
      <div className="unauth__body">
        <p className="unauth__eyebrow">401 · Authentication Required</p>
        <h1 className="unauth__title" id="unauth-title">
          Sign in to <em>continue</em>.
        </h1>
        <p className="unauth__desc">
          This page is protected. Sign in to pick up right where you left off —
          your tasks, streaks, and progress are all still here.
        </p>
      </div>

      {/* Trust row */}
      <div className="unauth__trust">
        <div className="unauth__trust-icon" aria-hidden="true">
          <CheckCircle2 />
        </div>
        <span>Your data is safe — nothing was lost or deleted.</span>
      </div>

      {/* CTAs */}
      <div className="unauth__actions">
        <Link
          className="unauth__btn-primary"
          href={buildSignInHref() as Route}
          id="unauth-signin-btn"
        >
          <span>Sign in</span>
          <ArrowRight aria-hidden="true" />
        </Link>
        <Link className="unauth__btn-secondary" href="/">
          Back to homepage
        </Link>
      </div>

      {/* Footer */}
      <footer className="unauth__footer">
        <p className="unauth__footer-text">
          No account yet?{" "}
          <Link className="unauth__footer-link" href="/sign-up">
            Create one free
          </Link>
        </p>
        <p className="unauth__note">
          Sessions are secured and end automatically after inactivity.
        </p>
      </footer>
    </main>
  )
}
