"use client"

import type { Route } from "next"

import { useState } from "react"
import {
  ArrowLeft,
  Ban,
  Check,
  CheckCircle2,
  Copy,
  FileCheck2,
  Mail,
  Scale,
  ShieldCheck,
  UserCheck,
} from "lucide-react"

import { BackButton } from "@/components/ui/back-button"
import { useLegalBackHref } from "@/components/legal/legal-shell-context"

type ClauseCategory = "all" | "basics" | "content" | "legal"

type TermClause = {
  category: "basics" | "content" | "legal"
  categoryLabel: string
  content: React.ReactNode
  id: string
  number: string
  title: string
}

const termsClauses: TermClause[] = [
  {
    category: "basics",
    categoryLabel: "Agreement & Operator",
    content: (
      <p>
        These Terms of Service are an agreement between you and Sourav Verma, an
        individual based in Jammu and Kashmir, India, who operates Traketo. By
        creating an account or using Traketo, you agree to these terms and the
        Privacy Policy. If you do not agree, do not use the service.
      </p>
    ),
    id: "clause-1",
    number: "01",
    title: "Agreement and operator",
  },
  {
    category: "basics",
    categoryLabel: "18+ Requirement",
    content: (
      <p>
        You must be at least 18 years old and legally capable of entering into
        this agreement. Traketo is a general productivity service; the age rule
        is used to avoid collecting children’s data without the additional
        permissions and safeguards required for minors.
      </p>
    ),
    id: "clause-2",
    number: "02",
    title: "Eligibility",
  },
  {
    category: "basics",
    categoryLabel: "Account & Access",
    content: (
      <p>
        You must provide accurate information, safeguard your credentials, and
        notify us if you suspect unauthorized access. You are responsible for
        activity performed through your account. You may use Google sign-in or
        email-based authentication where available.
      </p>
    ),
    id: "clause-3",
    number: "03",
    title: "Your account",
  },
  {
    category: "basics",
    categoryLabel: "Productivity Aid",
    content: (
      <>
        <p>
          Traketo provides tools for managing tasks, focus timers, reminders,
          progression, offline work, attachments, and shared-study sessions.
          Features may change as the service develops. We grant you a limited,
          personal, non-exclusive, non-transferable, revocable right to use the
          service in accordance with these terms.
        </p>
        <p>
          Traketo is a productivity aid, not professional, medical, financial,
          or legal advice. You remain responsible for your plans, deadlines, and
          decisions.
        </p>
      </>
    ),
    id: "clause-4",
    number: "04",
    title: "The service",
  },
  {
    category: "content",
    categoryLabel: "Ownership & Rights",
    content: (
      <>
        <p>
          You retain ownership of tasks, files, and other content you submit.
          You give us a limited permission to host, process, copy, transmit, and
          display that content only as reasonably needed to operate, secure, and
          improve the service or comply with law.
        </p>
        <p>
          When you join a shared-study room, you authorize Traketo to show other
          participants the limited profile and session information required for
          that feature. Do not upload or share content you do not have the right
          to use.
        </p>
      </>
    ),
    id: "clause-5",
    number: "05",
    title: "Your content",
  },
  {
    category: "content",
    categoryLabel: "Prohibited Actions",
    content: (
      <>
        <p>You must not engage in any of the following activities:</p>
        <ul className="terms-prohibit-list">
          <li>
            <span className="terms-prohibit-icon">
              <Ban aria-hidden="true" />
            </span>
            <span>
              Use Traketo for unlawful, fraudulent, abusive, or harmful
              activity;
            </span>
          </li>
          <li>
            <span className="terms-prohibit-icon">
              <Ban aria-hidden="true" />
            </span>
            <span>Harass others or distribute malware or illegal content;</span>
          </li>
          <li>
            <span className="terms-prohibit-icon">
              <Ban aria-hidden="true" />
            </span>
            <span>
              Probe, disrupt, overload, or bypass service security or access
              controls;
            </span>
          </li>
          <li>
            <span className="terms-prohibit-icon">
              <Ban aria-hidden="true" />
            </span>
            <span>
              Access another person’s account or data without authorization;
            </span>
          </li>
          <li>
            <span className="terms-prohibit-icon">
              <Ban aria-hidden="true" />
            </span>
            <span>
              Scrape or automate access in a way that burdens the service; or
            </span>
          </li>
          <li>
            <span className="terms-prohibit-icon">
              <Ban aria-hidden="true" />
            </span>
            <span>
              Reverse engineer the service except where applicable law permits
              it.
            </span>
          </li>
        </ul>
      </>
    ),
    id: "clause-6",
    number: "06",
    title: "Acceptable use",
  },
  {
    category: "content",
    categoryLabel: "Community Standards",
    content: (
      <p>
        Treat other participants respectfully and share only information you are
        comfortable making visible in the relevant room or workspace. You are
        responsible for attachments you upload and for ensuring they are lawful,
        safe, and free of malicious code. We may remove content or restrict
        access when reasonably necessary for security or compliance.
      </p>
    ),
    id: "clause-7",
    number: "07",
    title: "Shared features and attachments",
  },
  {
    category: "legal",
    categoryLabel: "External Providers",
    content: (
      <p>
        Traketo relies on third-party infrastructure and may offer integrations
        such as Google authentication. Those services may have their own terms
        and privacy practices. We are not responsible for third-party services
        that are outside our control.
      </p>
    ),
    id: "clause-8",
    number: "08",
    title: "Third-party services",
  },
  {
    category: "legal",
    categoryLabel: "Service Continuity",
    content: (
      <>
        <p>
          We aim to keep Traketo reliable, but the service is provided on an “as
          available” basis. Maintenance, network problems, third-party failures,
          software defects, or events outside our control may cause interruption
          or data-sync delays. Offline or queued changes can occasionally
          conflict with newer server data. Keep independent copies of
          information you cannot afford to lose.
        </p>
        <p>
          We may add, modify, suspend, or discontinue features. If paid features
          are introduced, their pricing and any additional terms will be shown
          before you purchase them.
        </p>
      </>
    ),
    id: "clause-9",
    number: "09",
    title: "Availability and changes",
  },
  {
    category: "legal",
    categoryLabel: "Account Closure",
    content: (
      <p>
        You may stop using Traketo and delete your account at any time. We may
        suspend or terminate access when you materially breach these terms,
        create a security or legal risk, abuse the service, or when continued
        operation is no longer reasonably possible. Where appropriate, we will
        try to provide notice and an opportunity to export your data.
      </p>
    ),
    id: "clause-10",
    number: "10",
    title: "Suspension and termination",
  },
  {
    category: "legal",
    categoryLabel: "Liability Limits",
    content: (
      <>
        <p>
          To the maximum extent permitted by law, Traketo is provided without
          warranties of uninterrupted availability, error-free operation,
          fitness for a particular purpose, or preservation of every item of
          data. Nothing in these terms excludes rights or liability that cannot
          legally be excluded.
        </p>
        <p>
          To the maximum extent permitted by law, the operator will not be
          liable for indirect, incidental, special, consequential, or punitive
          losses, or for lost data, profits, opportunities, or goodwill arising
          from your use of or inability to use Traketo.
        </p>
      </>
    ),
    id: "clause-11",
    number: "11",
    title: "Disclaimers and liability",
  },
  {
    category: "legal",
    categoryLabel: "Jurisdiction & India",
    content: (
      <p>
        These terms are governed by the laws of India. Subject to any consumer
        rights or mandatory dispute forum that applies to you, courts with
        jurisdiction in Jammu and Kashmir, India will have jurisdiction over
        disputes relating to these terms or Traketo. Please contact us first so
        we can try to resolve concerns informally.
      </p>
    ),
    id: "clause-12",
    number: "12",
    title: "Governing law and disputes",
  },
  {
    category: "legal",
    categoryLabel: "Amendments & Terms",
    content: (
      <p>
        We may update these terms as Traketo changes. We will post the updated
        terms here, change the effective date, and provide additional notice for
        material changes. If one provision is unenforceable, the remaining
        provisions continue to apply. A failure to enforce a provision is not a
        waiver of it. You may not transfer this agreement without our consent.
      </p>
    ),
    id: "clause-13",
    number: "13",
    title: "Changes and general terms",
  },
]

const filterOptions: { id: ClauseCategory; label: string }[] = [
  { id: "all", label: "All (13)" },
  { id: "basics", label: "Basics & Account (4)" },
  { id: "content", label: "Content & Conduct (3)" },
  { id: "legal", label: "Legal & Liability (6)" },
]

export function TermsExperience() {
  const backHref = useLegalBackHref()
  const [activeCategory, setActiveCategory] = useState<ClauseCategory>("all")
  const [copied, setCopied] = useState(false)

  const displayedClauses =
    activeCategory === "all"
      ? termsClauses
      : termsClauses.filter((clause) => clause.category === activeCategory)

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText("privacy@traketo.com")
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.location.href = "mailto:privacy@traketo.com"
    }
  }

  return (
    <div className="app-stage terms-shell">
      <div className="device-frame terms-frame" id="app-device-viewport">
        <main className="terms-page" id="main-content" tabIndex={0}>
          {/* Native Sticky Header */}
          <header className="terms-nav-header">
            <BackButton
              aria-label="Back"
              className="terms-back-btn"
              fallbackHref={backHref as Route}
            >
              <ArrowLeft aria-hidden="true" />
            </BackButton>
            <div className="terms-nav-title">
              <span className="terms-nav-wordmark">Terms of Service</span>
            </div>
            <div className="terms-status-chip">
              <span aria-hidden="true" className="terms-status-dot" />
              <span>Agreement Active</span>
            </div>
          </header>

          {/* Hero Banner */}
          <section className="terms-hero-banner">
            <div aria-hidden="true" className="terms-hero-banner__glow" />
            <div className="terms-hero-banner__content">
              <div className="terms-hero-meta">
                <span className="terms-hero-badge">
                  <Scale aria-hidden="true" />
                  <span>User Agreement</span>
                </span>
                <span className="terms-hero-date">Effective 26 Aug 2026</span>
              </div>
              <h1 className="terms-hero-banner__title">Terms of Service</h1>
              <p className="terms-hero-banner__desc">
                These terms set the ground rules for using Traketo and explain
                the responsibilities shared between you and the service.
              </p>
            </div>
          </section>

          {/* Rules at a Glance: 3 Core Pillars */}
          <section
            aria-label="Core agreement principles"
            className="terms-pillars-banner"
          >
            <div className="terms-pillars-title">
              <FileCheck2 aria-hidden="true" />
              <span>The Ground Rules at a Glance</span>
            </div>
            <div className="terms-pillars-grid">
              <div className="terms-pillar-card terms-pillar-card--blue">
                <div className="terms-pillar-card__icon">
                  <UserCheck aria-hidden="true" />
                </div>
                <div className="terms-pillar-card__text">
                  <strong>You own your work</strong>
                  <small>
                    Your tasks and files remain yours. We only process data to
                    run the app.
                  </small>
                </div>
              </div>
              <div className="terms-pillar-card terms-pillar-card--indigo">
                <div className="terms-pillar-card__icon">
                  <ShieldCheck aria-hidden="true" />
                </div>
                <div className="terms-pillar-card__text">
                  <strong>Fair &amp; safe conduct</strong>
                  <small>
                    No abuse, security exploits, harmful scraping, or spamming
                    shared spaces.
                  </small>
                </div>
              </div>
              <div className="terms-pillar-card terms-pillar-card--emerald">
                <div className="terms-pillar-card__icon">
                  <CheckCircle2 aria-hidden="true" />
                </div>
                <div className="terms-pillar-card__text">
                  <strong>Zero lock-in</strong>
                  <small>
                    Export your data and permanently delete your account anytime
                    in Settings.
                  </small>
                </div>
              </div>
            </div>
          </section>

          {/* Category Filter Strip */}
          <nav
            aria-label="Filter agreement clauses"
            className="terms-filter-section"
          >
            <div className="terms-filter-header">
              <span className="terms-filter-counter">
                Showing <strong>{displayedClauses.length}</strong> of{" "}
                {termsClauses.length} clauses
              </span>
            </div>
            <div className="terms-filter-strip" role="tablist">
              {filterOptions.map((opt) => {
                const isActive = activeCategory === opt.id
                return (
                  <button
                    aria-selected={isActive}
                    className={`terms-filter-btn ${
                      isActive ? "terms-filter-btn--active" : ""
                    }`}
                    key={opt.id}
                    onClick={() => setActiveCategory(opt.id)}
                    role="tab"
                    type="button"
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </nav>

          {/* Structured Clause Cards */}
          <section
            aria-label="Terms of service clauses"
            className="terms-clauses-list"
          >
            {displayedClauses.map((clause) => (
              <article className="terms-clause-card" key={clause.id}>
                <header className="terms-clause-header">
                  <div className="terms-clause-header-left">
                    <span className="terms-clause-num">{clause.number}</span>
                    <h2 className="terms-clause-title">{clause.title}</h2>
                  </div>
                  <span className="terms-clause-badge">
                    {clause.categoryLabel}
                  </span>
                </header>
                <div className="terms-clause-body">{clause.content}</div>
              </article>
            ))}
          </section>

          {/* Legal Operator & Support Card */}
          <aside aria-label="Legal inquiries" className="terms-support-card">
            <div className="terms-support-card__left">
              <span className="terms-support-card__icon">
                <Mail aria-hidden="true" />
              </span>
              <div className="terms-support-card__copy">
                <small>Legal Questions &amp; Notices</small>
                <strong>privacy@traketo.com</strong>
              </div>
            </div>
            <button
              className="terms-copy-btn"
              onClick={handleCopyEmail}
              type="button"
            >
              {copied ? (
                <Check aria-hidden="true" />
              ) : (
                <Copy aria-hidden="true" />
              )}
              <span>{copied ? "Copied" : "Copy email"}</span>
            </button>
          </aside>
        </main>
      </div>
    </div>
  )
}
