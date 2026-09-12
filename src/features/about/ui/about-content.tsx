"use client"

import type { Route } from "next"

import Link from "next/link"
import {
  ArrowLeft,
  Check,
  CheckSquare,
  Clock3,
  Repeat,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
  Zap,
} from "lucide-react"

import { WelcomeAvatar } from "@/features/authentication/ui/welcome-avatar"
import { BackButton } from "@/components/ui/back-button"
import { useLegalBackHref } from "@/components/legal/legal-shell-context"

const coreFeatures = [
  {
    colorClass: "about-feature-card--blue",
    description:
      "Turn busy days into clear, manageable next steps with daily queues.",
    icon: CheckSquare,
    title: "Plan clearly",
  },
  {
    colorClass: "about-feature-card--purple",
    description:
      "Give important work your full attention with distraction-free timers.",
    icon: Clock3,
    title: "Focus calmly",
  },
  {
    colorClass: "about-feature-card--emerald",
    description:
      "Stay encouraged through co-working spaces and mutual progress.",
    icon: UsersRound,
    title: "Grow together",
  },
  {
    colorClass: "about-feature-card--amber",
    description:
      "Repeat cadences and gentle alerts that fit your natural rhythm.",
    icon: Repeat,
    title: "Gentle cadence",
  },
  {
    colorClass: "about-feature-card--sky",
    description:
      "Zero ads, no third-party data selling, and encrypted local storage.",
    icon: ShieldCheck,
    title: "Private by design",
  },
  {
    colorClass: "about-feature-card--rose",
    description: "Instant fast PWA that works offline everywhere you need it.",
    icon: Zap,
    title: "Offline ready",
  },
] as const

export function AboutContent() {
  const backHref = useLegalBackHref()

  return (
    <div className="app-stage about-shell">
      <div className="device-frame about-frame" id="app-device-viewport">
        <main className="about-page" id="main-content" tabIndex={0}>
          {/* Top navigation header: Clean, integrated, native-app top bar */}
          <header className="about-nav-header">
            <BackButton
              aria-label="Back"
              className="about-back-btn"
              fallbackHref={backHref as Route}
            >
              <ArrowLeft aria-hidden="true" />
            </BackButton>
            <div className="about-nav-title">
              <span className="about-nav-wordmark">About Traketo</span>
            </div>
            <div className="about-status-chip">
              <span aria-hidden="true" className="about-status-dot" />
              <span>Calm Focus</span>
            </div>
          </header>

          {/* Hero section */}
          <section className="about-hero-banner">
            <div aria-hidden="true" className="about-hero-banner__glow" />
            <div className="about-hero-banner__content">
              <div className="about-hero-banner__badge">
                <Sparkles aria-hidden="true" />
                <span>Our Story &amp; Purpose</span>
              </div>
              <div className="about-hero-banner__main">
                <div>
                  <h1 className="about-hero-banner__title">
                    A calmer way to make progress.
                  </h1>
                  <p className="about-hero-banner__desc">
                    Traketo brings planning, focus sessions, reminders, and
                    shared study into one thoughtful space—so your day feels
                    doable, not crowded.
                  </p>
                </div>
                <div className="about-hero-banner__visual">
                  <span
                    aria-hidden="true"
                    className="about-hero-banner__halo"
                  />
                  <WelcomeAvatar
                    alt="Traketo guide companion illustration"
                    className="about-hero-banner__avatar"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Core Pillars: 6 Interactive Feature Pills */}
          <section
            aria-label="Core features"
            className="about-features-section"
          >
            <div className="about-section-label">
              <span className="about-section-step">Step 1</span>
              <h2>Designed for real life</h2>
            </div>
            <div className="about-features-grid">
              {coreFeatures.map(
                ({ colorClass, description, icon: Icon, title }) => (
                  <article
                    className={`about-feature-card ${colorClass}`}
                    key={title}
                  >
                    <span className="about-feature-card__icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <div className="about-feature-card__text">
                      <h3>{title}</h3>
                      <small>{description}</small>
                    </div>
                  </article>
                ),
              )}
            </div>
          </section>

          {/* Philosophy / Why Traketo */}
          <section aria-label="Why Traketo" className="about-philosophy-card">
            <div className="about-philosophy-card__header">
              <div>
                <span className="about-section-step">Philosophy</span>
                <h2>Productivity without burnout</h2>
              </div>
              <span className="about-philosophy-card__badge-icon">
                <Sparkles aria-hidden="true" />
              </span>
            </div>
            <div className="about-philosophy-points">
              <div className="about-philosophy-point about-philosophy-point--cross">
                <X aria-hidden="true" />
                <span>No endless notifications or guilt trips</span>
              </div>
              <div className="about-philosophy-point about-philosophy-point--cross">
                <X aria-hidden="true" />
                <span>No aggressive streaks or toxic gamification</span>
              </div>
              <div className="about-philosophy-point about-philosophy-point--check">
                <Check aria-hidden="true" />
                <span>Small, sustainable steps with visible clarity</span>
              </div>
            </div>
            <div className="about-metrics-row">
              <span className="about-metric-pill">
                <ShieldCheck aria-hidden="true" /> 100% Ad-Free
              </span>
              <span className="about-metric-pill">
                <Zap aria-hidden="true" /> Offline-First
              </span>
              <span className="about-metric-pill">
                <Clock3 aria-hidden="true" /> Distraction-Free
              </span>
            </div>
          </section>

          {/* Trust & Privacy Card */}
          <section aria-label="Privacy commitment" className="about-trust-card">
            <span className="about-trust-card__icon">
              <ShieldCheck aria-hidden="true" />
            </span>
            <div className="about-trust-card__content">
              <span className="about-trust-card__badge">Privacy First</span>
              <h2>Private by design</h2>
              <p>
                Your tasks and routines are personal. Traketo does not sell
                personal data or use it for third-party advertising.
              </p>
              <Link className="about-trust-card__link" href="/privacy">
                Privacy &amp; Data Centre &rarr;
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
