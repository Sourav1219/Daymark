"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CheckSquare,
  ChevronDown,
  Clock3,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react"

import { AuthForm } from "@/features/authentication/ui/auth-form"
import type { GoogleOAuthError } from "@/features/authentication/ui/google-auth-button"
import { WelcomeAvatar } from "@/features/authentication/ui/welcome-avatar"

type AuthMode = "welcome" | "login" | "register"
export type AuthNotice = "verification-error" | null

type AuthExperienceProps = Readonly<{
  googleAuthConfigured: boolean
  initial: AuthMode
  nextPath: string
  notice: AuthNotice
  oauthError: GoogleOAuthError
  skipEntranceAnimation?: boolean
}>

/**
 * Auth entry point.
 *
 * `/sign-in` opens on the welcome screen (the app's front door); `/sign-up`
 * opens directly on the registration form. From the welcome, "Get started"
 * reveals the registration form and "I already have an account" reveals the
 * login form — both wired to the existing auth backend.
 */
export function AuthExperience({
  googleAuthConfigured,
  initial,
  nextPath,
  notice,
  oauthError,
  skipEntranceAnimation = false,
}: AuthExperienceProps) {
  const [mode, setMode] = useState<AuthMode>(initial)

  if (mode === "login") {
    return (
      <AuthForm
        googleAuthConfigured={googleAuthConfigured}
        key="login"
        mode="login"
        nextPath={nextPath}
        notice={notice}
        oauthError={oauthError}
        onSwitchMode={setMode}
        skipEntranceAnimation={skipEntranceAnimation}
      />
    )
  }

  if (mode === "register") {
    return (
      <AuthForm
        googleAuthConfigured={googleAuthConfigured}
        key="register"
        mode="register"
        nextPath={nextPath}
        notice={notice}
        oauthError={oauthError}
        onSwitchMode={setMode}
        skipEntranceAnimation={skipEntranceAnimation}
      />
    )
  }

  return (
    <main className="welcome welcome--immersive">
      <div className="welcome__hero-stage">
        <div className="welcome__inner">
          <section className="welcome__visual">
            <header className="welcome__topbar">
              <span className="welcome__wordmark">
                <span aria-hidden="true" /> Traketo
              </span>
              <span className="welcome__edition">Your day, made doable</span>
            </header>
            <div className="welcome__art">
              <span aria-hidden="true" className="welcome__halo" />
              <span
                aria-hidden="true"
                className="welcome__ring welcome__ring--one"
              />
              <span
                aria-hidden="true"
                className="welcome__ring welcome__ring--two"
              />
              <WelcomeAvatar
                alt="Traketo guide mascot welcoming you to your workspace"
                className="welcome__avatar"
              />
            </div>
          </section>

          <section className="welcome__panel" aria-labelledby="welcome-title">
            <span aria-hidden="true" className="welcome__handle" />
            <div className="welcome__copy">
              <span className="welcome__eyebrow">Plan · Focus · Finish</span>
              <h1 className="welcome__brand" id="welcome-title">
                Turn plans into <em>progress.</em>
              </h1>
              <p className="welcome__tagline">
                Tasks, focus sessions, and shared study—together in one calm
                place.
              </p>
            </div>

            <div className="welcome__actions">
              <button
                className="welcome__cta"
                onClick={() => setMode("register")}
                type="button"
              >
                <span>Get started</span>
                <ArrowRight aria-hidden="true" />
              </button>
              <button
                className="welcome__cta welcome__cta--secondary"
                onClick={() => setMode("login")}
                type="button"
              >
                I already have an account
              </button>
            </div>

            <div className="mt-4 text-center text-xs text-ink-muted">
              <span>Having trouble?</span>{" "}
              <Link
                className="font-semibold text-system-blue underline underline-offset-2 hover:opacity-80"
                href="/contact"
              >
                Contact support
              </Link>
            </div>

            <div aria-hidden="true" className="welcome__scroll-hint">
              <span>Explore features</span>
              <ChevronDown className="welcome__scroll-chevron" />
            </div>
          </section>
        </div>
      </div>

      <section aria-labelledby="showcase-title" className="welcome__showcase">
        <header className="welcome__showcase-header">
          <span className="welcome__showcase-eyebrow">
            <Sparkles aria-hidden="true" className="size-3.5" />
            <span>Why Traketo</span>
          </span>
          <h2 className="welcome__showcase-title" id="showcase-title">
            A calmer, clearer way to organize your life and studies.
          </h2>
          <p className="welcome__showcase-desc">
            Traketo transforms scattered thoughts and overwhelming to-do lists
            into quiet, sustained momentum. Designed for students, creators, and
            professionals who value focused deep work over digital clutter and
            anxiety.
          </p>
        </header>

        <div className="welcome__showcase-grid">
          <article className="welcome__feature-card">
            <span className="welcome__feature-icon welcome__feature-icon--emerald">
              <CheckSquare aria-hidden="true" />
            </span>
            <h3>Daily Quests &amp; Prioritization</h3>
            <p>
              Break intimidating goals into bite-sized daily quests. Smart
              rollover queues, customizable priority labels, and intuitive
              checklists keep your schedule achievable.
            </p>
          </article>

          <article className="welcome__feature-card">
            <span className="welcome__feature-icon welcome__feature-icon--purple">
              <Clock3 aria-hidden="true" />
            </span>
            <h3>Deep Focus Timer &amp; Flow State</h3>
            <p>
              Maintain cognitive flow with flexible Pomodoro blocks, restorative
              break pacing, and gentle acoustic alerts designed to prevent
              mental fatigue.
            </p>
          </article>

          <article className="welcome__feature-card">
            <span className="welcome__feature-icon welcome__feature-icon--blue">
              <UsersRound aria-hidden="true" />
            </span>
            <h3>Study Together &amp; Shared Streaks</h3>
            <p>
              Enter live co-working sessions with study partners. Build
              accountability, celebrate daily milestones, and turn solitary
              studying into shared motivation.
            </p>
          </article>

          <article className="welcome__feature-card">
            <span className="welcome__feature-icon welcome__feature-icon--teal">
              <ShieldCheck aria-hidden="true" />
            </span>
            <h3>Private by Design &amp; Zero Trackers</h3>
            <p>
              Your habits and notes remain entirely your own. We run zero
              advertising scripts, sell no data, and enforce strict GDPR and
              India DPDP Act 2023 compliance.
            </p>
          </article>
        </div>

        <footer className="welcome__showcase-footer">
          <nav aria-label="Quick links" className="welcome__showcase-links">
            <Link className="welcome__showcase-link" href="/about">
              About Traketo
            </Link>
            <Link className="welcome__showcase-link" href="/contact">
              Help &amp; FAQs
            </Link>
            <Link className="welcome__showcase-link" href="/privacy">
              Privacy Policy
            </Link>
            <Link className="welcome__showcase-link" href="/terms">
              Terms of Service
            </Link>
          </nav>
          <p className="welcome__showcase-copy">
            &copy; {new Date().getFullYear()} Traketo. Made for calm, focused
            minds.
          </p>
        </footer>
      </section>
    </main>
  )
}
