"use client"

import type { Route } from "next"

import Link from "next/link"
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ListChecks,
  ShieldCheck,
  UsersRound,
} from "lucide-react"

import { WelcomeAvatar } from "@/features/authentication/ui/welcome-avatar"
import { BackButton } from "@/components/ui/back-button"
import { useLegalBackHref } from "@/components/legal/legal-shell-context"

const principles = [
  {
    description: "Turn busy days into a clear, manageable next step.",
    icon: ListChecks,
    title: "Plan clearly",
  },
  {
    description: "Give important work your full attention with focus sessions.",
    icon: Clock3,
    title: "Focus calmly",
  },
  {
    description: "Stay encouraged through visible progress and shared study.",
    icon: UsersRound,
    title: "Grow together",
  },
] as const

export function AboutContent() {
  const backHref = useLegalBackHref()
  const isAuthenticated = backHref === "/profile"

  return (
    <main className="about-shell">
      <div className="about-frame">
        <header className="about-header">
          <BackButton
            aria-label="Back to Traketo"
            fallbackHref={backHref as Route}
          >
            <ArrowLeft aria-hidden="true" />
          </BackButton>
          <span className="about-wordmark">
            <span aria-hidden="true" /> Traketo
          </span>
          <span>About</span>
        </header>

        <div className="about-content">
          <section className="about-hero">
            <div className="about-hero__copy">
              <span className="about-kicker">
                <CheckCircle2 aria-hidden="true" /> Built for real life
              </span>
              <h1>A calmer way to make progress.</h1>
              <p>
                Traketo brings planning, focus, reminders, and shared study into
                one thoughtful space—so your day feels doable, not crowded.
              </p>
            </div>
            <div aria-hidden="true" className="about-hero__visual">
              <span className="about-hero__halo" />
              <WelcomeAvatar className="about-hero__avatar" />
            </div>
          </section>

          <section aria-labelledby="about-purpose" className="about-purpose">
            <span>Why Traketo</span>
            <h2 id="about-purpose">Built around how progress actually works</h2>
            <p>
              Small steps become meaningful momentum when they are easy to see,
              start, and finish.
            </p>

            <div className="about-principles">
              {principles.map(({ description, icon: Icon, title }) => (
                <article key={title}>
                  <span>
                    <Icon aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="about-privacy">
            <span>
              <ShieldCheck aria-hidden="true" />
            </span>
            <div>
              <small>Our approach</small>
              <h2>Private by design</h2>
              <p>
                Your tasks and routines are personal. Traketo does not sell
                personal data or use it for third-party advertising.
              </p>
            </div>
          </section>

          {/* Only show sign-up CTA for unauthenticated visitors */}
          {!isAuthenticated && (
            <div className="about-actions">
              <Link className="about-primary-action" href="/sign-up">
                Get started
              </Link>
            </div>
          )}

          <footer className="about-footer">
            <Link href="/terms">Terms</Link>
            <span aria-hidden="true">·</span>
            <Link href="/privacy">Privacy</Link>
          </footer>
        </div>
      </div>
    </main>
  )
}
