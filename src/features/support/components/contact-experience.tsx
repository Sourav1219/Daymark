"use client"

import { useState, type FormEvent } from "react"
import type { Route } from "next"
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckSquare,
  Clock3,
  Copy,
  HelpCircle,
  KeyRound,
  Mail,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

import { BackButton } from "@/components/ui/back-button"
import { useLegalBackHref } from "@/components/legal/legal-shell-context"

const contactTopics = [
  {
    icon: KeyRound,
    label: "Account & sign-in",
    summary: "Sign in, password reset, or account settings",
    value: "account",
  },
  {
    icon: CheckSquare,
    label: "Tasks, reminders & focus",
    summary: "Daily quests, timers, reminders, or tags",
    value: "product",
  },
  {
    icon: BookOpen,
    label: "Shared study",
    summary: "Study rooms, invites, and member sync",
    value: "shared-study",
  },
  {
    icon: ShieldCheck,
    label: "Privacy & my data",
    summary: "Data export, consent, and account privacy",
    value: "privacy",
  },
  {
    icon: Sparkles,
    label: "Feedback or suggestion",
    summary: "Ideas to improve Traketo or feature requests",
    value: "feedback",
  },
  {
    icon: HelpCircle,
    label: "Something else",
    summary: "General inquiries and miscellaneous topics",
    value: "other",
  },
] as const

type ContactTopic = (typeof contactTopics)[number]["value"]

type ContactExperienceProps = Readonly<{
  initialEmail?: string | undefined
  initialName?: string | undefined
}>

export function ContactExperience({
  initialEmail,
  initialName,
}: ContactExperienceProps) {
  const backHref = useLegalBackHref()
  const [name, setName] = useState(initialName ?? "")
  const [email, setEmail] = useState(initialEmail ?? "")
  const [message, setMessage] = useState("")
  const [topic, setTopic] = useState<ContactTopic>("account")
  const [copied, setCopied] = useState(false)

  const isPrivacyTopic = topic === "privacy"
  const targetEmail = isPrivacyTopic
    ? "privacy@traketo.com"
    : "support@traketo.com"

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(targetEmail)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Browser blocked clipboard; email is visible on screen
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const topicLabel =
      contactTopics.find((option) => option.value === topic)?.label ??
      "General question"
    const subject = `Traketo: ${topicLabel}`
    const senderName = name.trim() || initialName?.trim() || "User"
    const senderEmail = email.trim() || initialEmail?.trim() || "Unspecified"

    const body = [
      `Name: ${senderName}`,
      `Email: ${senderEmail}`,
      `Topic: ${topicLabel}`,
      "",
      message.trim(),
    ].join("\n")

    window.location.assign(
      `mailto:${targetEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    )
  }

  const currentTopicLabel =
    contactTopics.find((option) => option.value === topic)?.label ??
    "General question"

  const userInitial = (
    name.trim() ||
    initialName?.trim() ||
    email.trim() ||
    "U"
  )
    .charAt(0)
    .toUpperCase()

  return (
    <div className="app-stage contact-shell">
      <div className="device-frame contact-frame" id="app-device-viewport">
        <main className="contact-page" id="main-content" tabIndex={0}>
          {/* Top navigation header: Clean, integrated, native-app top bar */}
          <header className="contact-nav-header">
            <BackButton
              aria-label="Back"
              className="contact-back-btn"
              fallbackHref={backHref as Route}
            >
              <ArrowLeft aria-hidden="true" />
            </BackButton>
            <div className="contact-nav-title">
              <span className="contact-nav-wordmark">Traketo Support</span>
            </div>
            <div className="contact-status-chip">
              <span aria-hidden="true" className="contact-status-dot" />
              <span>Replies in 24h</span>
            </div>
          </header>

          {/* Hero section */}
          <section className="contact-hero-banner">
            <div aria-hidden="true" className="contact-hero-banner__glow" />
            <div className="contact-hero-banner__content">
              <div className="contact-hero-banner__badge">
                <Sparkles aria-hidden="true" />
                <span>Help &amp; Support</span>
              </div>
              <h1 className="contact-hero-banner__title">Contact us</h1>
              <p className="contact-hero-banner__desc">
                Have a question, feedback, or need assistance? Select a topic
                and we’ll get you in touch with the right team.
              </p>
            </div>
          </section>

          {/* Step 1: Interactive Topic Selector */}
          <section
            aria-label="Support topics"
            className="contact-topics-section"
          >
            <div className="contact-section-label">
              <span className="contact-section-step">Step 1</span>
              <h2>Choose a topic</h2>
            </div>
            <div
              aria-label="Choose a topic"
              className="contact-topics-grid"
              role="radiogroup"
            >
              {contactTopics.map((item) => {
                const isSelected = topic === item.value
                const Icon = item.icon
                return (
                  <button
                    aria-checked={isSelected}
                    className={`contact-topic-card ${
                      isSelected ? "contact-topic-card--selected" : ""
                    }`}
                    key={item.value}
                    onClick={() => setTopic(item.value)}
                    role="radio"
                    type="button"
                  >
                    <span className="contact-topic-card__icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <div className="contact-topic-card__text">
                      <strong>{item.label}</strong>
                      <small>{item.summary}</small>
                    </div>
                    {isSelected ? (
                      <span
                        aria-hidden="true"
                        className="contact-topic-card__check"
                      >
                        <Check />
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Step 2: Message Form */}
          <form className="contact-form" onSubmit={handleSubmit}>
            <div className="contact-form__heading">
              <div>
                <div className="contact-form__meta">
                  <span className="contact-section-step">Step 2</span>
                  <span className="contact-form__topic-tag">
                    Topic: <strong>{currentTopicLabel}</strong>
                  </span>
                </div>
                <h2>Your message details</h2>
              </div>
              <span className="contact-form__badge-icon">
                <Mail aria-hidden="true" />
              </span>
            </div>

            {/* Hidden accessible select for screen readers and test compatibility */}
            <select
              aria-label="What do you need help with?"
              className="sr-only"
              onChange={(event) => setTopic(event.target.value as ContactTopic)}
              tabIndex={-1}
              value={topic}
            >
              {contactTopics.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {/* If user is signed in, show a clean active profile session pill */}
            {initialEmail ? (
              <div className="contact-user-chip">
                <span className="contact-user-chip__avatar">{userInitial}</span>
                <div className="contact-user-chip__details">
                  <span className="contact-user-chip__label">Signed in as</span>
                  <strong className="contact-user-chip__name">
                    {initialName || "Traketo User"}
                  </strong>
                  <span className="contact-user-chip__email">
                    {initialEmail}
                  </span>
                </div>
              </div>
            ) : null}

            <label className="contact-field">
              <span>Your name</span>
              <input
                autoComplete="name"
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                placeholder="What should we call you?"
                required
                type="text"
                value={name}
              />
            </label>

            <label className="contact-field">
              <span>Your email address</span>
              <input
                autoCapitalize="none"
                autoComplete="email"
                inputMode="email"
                maxLength={320}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Where should we reply?"
                required
                type="email"
                value={email}
              />
            </label>

            <label className="contact-field">
              <span>How can we help?</span>
              <textarea
                maxLength={2000}
                minLength={10}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Share the details, what you expected, and anything you already tried…"
                required
                rows={6}
                value={message}
              />
              <small>{message.length}/2000 characters</small>
            </label>

            <button className="contact-submit" type="submit">
              <Send aria-hidden="true" />
              <span>Continue in email</span>
              <ArrowRight aria-hidden="true" />
            </button>
          </form>

          {/* Direct email quick action */}
          <section aria-label="Direct email option" className="contact-direct">
            <span className="contact-direct__icon">
              <Mail aria-hidden="true" />
            </span>
            <div className="contact-direct__copy">
              <small>Direct Email</small>
              <strong>{targetEmail}</strong>
            </div>
            <button
              className="contact-copy-btn"
              onClick={handleCopyEmail}
              type="button"
            >
              {copied ? (
                <Check aria-hidden="true" />
              ) : (
                <Copy aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy email"}
            </button>
          </section>

          {/* Security note */}
          <aside className="contact-note">
            <Clock3 aria-hidden="true" />
            <p>
              Please do not include passwords or verification codes. We’ll
              review your message as soon as possible.
            </p>
          </aside>
        </main>
      </div>
    </div>
  )
}
