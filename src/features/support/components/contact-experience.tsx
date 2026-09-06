"use client"

import { useState, type FormEvent } from "react"
import type { Route } from "next"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Mail,
  MessageCircleMore,
  Send,
} from "lucide-react"

import { BackButton } from "@/components/ui/back-button"
import { useLegalBackHref } from "@/components/legal/legal-shell-context"

const contactTopics = [
  { label: "Account & sign-in", value: "account" },
  { label: "Tasks, reminders & focus", value: "product" },
  { label: "Shared study", value: "shared-study" },
  { label: "Privacy & my data", value: "privacy" },
  { label: "Feedback or suggestion", value: "feedback" },
  { label: "Something else", value: "other" },
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

  return (
    <main className="contact-shell">
      <div className="contact-frame">
        <div className="contact-page">
          <header className="contact-header">
            <BackButton aria-label="Back" fallbackHref={backHref as Route}>
              <ArrowLeft aria-hidden="true" />
            </BackButton>
            <div>
              <span>Help &amp; support</span>
              <h1>Contact us</h1>
            </div>
            <span aria-hidden="true" />
          </header>

          <section className="contact-hero">
            <span aria-hidden="true" className="contact-hero__orb" />
            <span className="contact-hero__icon">
              <MessageCircleMore aria-hidden="true" />
            </span>
            <div>
              <span>We’re here to help</span>
              <h2>What can we help with?</h2>
              <p>
                Choose a topic and tell us what happened. Your email app will
                open with everything ready for you to review and send.
              </p>
            </div>
          </section>

          <form className="contact-form" onSubmit={handleSubmit}>
            <div className="contact-form__heading">
              <div>
                <span>Message details</span>
                <h2>Start a conversation</h2>
              </div>
              <Mail aria-hidden="true" />
            </div>

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
              <span>What do you need help with?</span>
              <span className="contact-select-wrap">
                <select
                  onChange={(event) =>
                    setTopic(event.target.value as ContactTopic)
                  }
                  value={topic}
                >
                  {contactTopics.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" />
              </span>
            </label>

            <label className="contact-field">
              <span>How can we help?</span>
              <textarea
                maxLength={2000}
                minLength={10}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Share the details, what you expected, and anything you already tried…"
                required
                rows={7}
                value={message}
              />
              <small>{message.length}/2000 characters</small>
            </label>

            <button className="contact-submit" type="submit">
              <Send aria-hidden="true" />
              Continue in email
              <ArrowRight aria-hidden="true" />
            </button>
          </form>

          <section aria-label="Direct email option" className="contact-direct">
            <div>
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

          <aside className="contact-note">
            <Clock3 aria-hidden="true" />
            <p>
              Please do not include passwords or verification codes. We’ll
              review your message as soon as possible.
            </p>
          </aside>
        </div>
      </div>
    </main>
  )
}
