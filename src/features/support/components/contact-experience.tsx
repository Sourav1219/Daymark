"use client"

import { useState, type FormEvent } from "react"
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Clock3,
  Mail,
  MessageCircleMore,
  Send,
} from "lucide-react"

import { BackButton } from "@/components/ui/back-button"

const contactAddress = "privacy@traketo.com"
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
  email: string
  name: string
}>

export function ContactExperience({ email, name }: ContactExperienceProps) {
  const [message, setMessage] = useState("")
  const [topic, setTopic] = useState<ContactTopic>("account")

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const topicLabel =
      contactTopics.find((option) => option.value === topic)?.label ??
      "General question"
    const subject = `Traketo: ${topicLabel}`
    const body = [
      `Name: ${name}`,
      `Account email: ${email}`,
      `Topic: ${topicLabel}`,
      "",
      message.trim(),
    ].join("\n")

    window.location.assign(
      `mailto:${contactAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    )
  }

  return (
    <div className="contact-page">
      <header className="contact-header">
        <BackButton aria-label="Back to profile" fallbackHref="/profile">
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
            Choose a topic and tell us what happened. Your email app will open
            with everything ready for you to review and send.
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
          <span>What do you need help with?</span>
          <span className="contact-select-wrap">
            <select
              onChange={(event) => setTopic(event.target.value as ContactTopic)}
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

      <aside className="contact-note">
        <Clock3 aria-hidden="true" />
        <p>
          Please do not include passwords or verification codes. We’ll review
          your message as soon as possible.
        </p>
      </aside>
    </div>
  )
}
