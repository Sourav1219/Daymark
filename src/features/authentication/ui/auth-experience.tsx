"use client"

import { useState } from "react"
import { ArrowRight, ShieldCheck } from "lucide-react"

import { AuthForm } from "@/features/authentication/ui/auth-form"
import type { GoogleOAuthError } from "@/features/authentication/ui/google-auth-button"
import { WelcomeAvatar } from "@/features/authentication/ui/welcome-avatar"

type AuthMode = "welcome" | "login" | "register"
export type AuthNotice = "password-reset" | "verification-error" | null

type AuthExperienceProps = Readonly<{
  googleAuthConfigured: boolean
  initial: AuthMode
  nextPath: string
  notice: AuthNotice
  oauthError: GoogleOAuthError
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
      />
    )
  }

  return (
    <main className="welcome welcome--immersive">
      <div className="welcome__inner">
        <section className="welcome__visual" aria-hidden="true">
          <header className="welcome__topbar">
            <span className="welcome__wordmark">
              <span /> Traketo
            </span>
            <span className="welcome__edition">Your day, made doable</span>
          </header>
          <div className="welcome__art">
            <span className="welcome__halo" />
            <span className="welcome__ring welcome__ring--one" />
            <span className="welcome__ring welcome__ring--two" />
            <WelcomeAvatar className="welcome__avatar" />
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

          <p className="welcome__trust">
            <ShieldCheck aria-hidden="true" /> Private by default
          </p>

          <p className="welcome__legal">
            By continuing, you agree to Traketo’s{" "}
            <span className="welcome__legal-link">Terms</span> and{" "}
            <span className="welcome__legal-link">Privacy Policy</span>.
          </p>
        </section>
      </div>
    </main>
  )
}
