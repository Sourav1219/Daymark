"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import dynamic from "next/dynamic"

import type { GoogleOAuthError } from "@/features/authentication/ui/google-auth-button"
import { WelcomeAvatar } from "@/features/authentication/ui/welcome-avatar"

const AuthForm = dynamic(
  () =>
    import("@/features/authentication/ui/auth-form").then(
      (mod) => mod.AuthForm,
    ),
  { ssr: true },
)

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
          <section aria-hidden="true" className="welcome__visual">
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
                prefetch={false}
              >
                Contact support
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
