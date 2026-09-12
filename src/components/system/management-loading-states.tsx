import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckSquare,
  Clock3,
  Database,
  Download,
  FileCheck2,
  FileText,
  Inbox,
  LockKeyhole,
  Mail,
  PanelsTopLeft,
  Scale,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react"

import { LoadingPlaceholder } from "@/components/system/loading-placeholder"
import { PageHeading } from "@/components/system/page-heading"
import { BackButton } from "@/components/ui/back-button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function GatesLoadingState() {
  return (
    <div
      aria-label="Loading Lists"
      className="grid gap-section exact-route-loading"
      role="status"
    >
      <span className="sr-only">Loading Lists</span>
      <PageHeading
        actions={<LoadingPlaceholder className="exact-loading__badge" />}
        as="h2"
        description="Organise tasks into named Lists. Each List offers a shareable filtered view of your tasks, and archived Lists keep history without cluttering active work."
        eyebrow="Lists"
        title="Lists"
      />
      <ManagementCreateCard
        description="Group related tasks into a named, shareable view."
        title="Create List"
      />
      <ManagementSection
        description="Assign tasks to a List to build focused, shareable views."
        title="Active Lists"
      />
      <ManagementSection
        className="border-t border-border-soft pt-section"
        description="Archived Lists keep their task assignments but leave active navigation."
        title="Archived Lists"
      />
    </div>
  )
}

export function SettingsLoadingState() {
  return (
    <div
      aria-label="Loading Settings"
      className="grid gap-section exact-route-loading"
      role="status"
    >
      <span className="sr-only">Loading Settings</span>
      <PageHeading
        as="h2"
        description="Tune dates, reminders, and offline access around your routine."
        eyebrow="Settings"
        title="Settings"
      />
      <section aria-hidden="true" className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold">Preferences</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Keep dates, reminders, and offline access aligned with your routine.
          </p>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <SettingsCard
            className="xl:col-span-2"
            description="See open tasks with less than 30 minutes remaining."
            icon="bell"
            title="Reminder inbox"
          />
          <SettingsCard
            description="Create, edit, or cancel one-shot delivery schedules."
            icon="bell"
            title="Task reminders"
          />
          <SettingsCard
            description="Keep recent tasks and queued changes available offline."
            icon="download"
            title="Install and offline access"
          />
          <SettingsCard
            className="xl:col-span-2"
            description="Review how Traketo handles your data and the rules for using the service."
            icon="shield"
            title="Legal and privacy"
          />
        </div>
      </section>
    </div>
  )
}

export function ContactLoadingState() {
  return (
    <div className="app-stage contact-shell">
      <div className="device-frame contact-frame" id="app-device-viewport">
        <main
          aria-label="Loading Contact us"
          className="contact-page exact-route-loading"
          id="main-content"
          role="status"
          tabIndex={0}
        >
          <span className="sr-only">Loading Contact us</span>
          <header className="contact-nav-header">
            <BackButton
              aria-label="Back"
              className="contact-back-btn"
              fallbackHref="/sign-in"
            >
              <ArrowLeft />
            </BackButton>
            <div className="contact-nav-title">
              <span className="contact-nav-wordmark">Traketo Support</span>
            </div>
            <div className="contact-status-chip">
              <span aria-hidden="true" className="contact-status-dot" />
              <span>Replies in 24h</span>
            </div>
          </header>

          <section className="contact-hero-banner">
            <div aria-hidden="true" className="contact-hero-banner__glow" />
            <div className="contact-hero-banner__content">
              <div className="contact-hero-banner__badge">
                <Sparkles aria-hidden="true" />
                <span>Help &amp; Support</span>
              </div>
              <p className="contact-hero-banner__title">Contact us</p>
              <p className="contact-hero-banner__desc">
                Have a question, feedback, or need assistance? Select a topic
                and we’ll get you in touch with the right team.
              </p>
            </div>
          </section>

          <div aria-hidden="true" className="contact-form">
            <div className="contact-form__heading">
              <div>
                <div className="contact-form__meta">
                  <span className="contact-section-step">Step 2</span>
                  <span className="contact-form__topic-tag">
                    Topic: <strong>Account &amp; sign-in</strong>
                  </span>
                </div>
                <p>Your message details</p>
              </div>
              <Mail />
            </div>
            <label className="contact-field">
              <span>Your name</span>
              <input
                disabled
                placeholder="What should we call you?"
                type="text"
              />
            </label>
            <label className="contact-field">
              <span>Your email address</span>
              <input
                disabled
                placeholder="Where should we reply?"
                type="email"
              />
            </label>
            <label className="contact-field">
              <span>How can we help?</span>
              <textarea
                disabled
                placeholder="Share the details, what you expected, and anything you already tried…"
                rows={6}
              />
              <small>0/2000 characters</small>
            </label>
            <button className="contact-submit" disabled type="button">
              <Send /> Continue in email <ArrowRight />
            </button>
          </div>
          <aside className="contact-note">
            <Clock3 />
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

export function AboutLoadingState() {
  return (
    <div className="app-stage about-shell">
      <div className="device-frame about-frame" id="app-device-viewport">
        <main
          aria-label="Loading About Traketo"
          className="about-page exact-route-loading"
          id="main-content"
          role="status"
          tabIndex={0}
        >
          <span className="sr-only">Loading About Traketo</span>
          <header className="about-nav-header">
            <BackButton
              aria-label="Back"
              className="about-back-btn"
              fallbackHref="/sign-in"
            >
              <ArrowLeft />
            </BackButton>
            <div className="about-nav-title">
              <span className="about-nav-wordmark">About Traketo</span>
            </div>
            <div className="about-status-chip">
              <span aria-hidden="true" className="about-status-dot" />
              <span>Calm Focus</span>
            </div>
          </header>

          <section className="about-hero-banner">
            <div aria-hidden="true" className="about-hero-banner__glow" />
            <div className="about-hero-banner__content">
              <div className="about-hero-banner__badge">
                <Sparkles aria-hidden="true" />
                <span>Our Story &amp; Purpose</span>
              </div>
              <div className="about-hero-banner__main">
                <div>
                  <p className="about-hero-banner__title">
                    A calmer way to make progress.
                  </p>
                  <p className="about-hero-banner__desc">
                    Traketo brings planning, focus sessions, reminders, and
                    shared study into one thoughtful space—so your day feels
                    doable, not crowded.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section
            aria-label="Core features"
            className="about-features-section"
          >
            <div className="about-section-label">
              <span className="about-section-step">Step 1</span>
              <p>Designed for real life</p>
            </div>
            <div className="about-features-grid">
              <div className="about-feature-card about-feature-card--blue">
                <span className="about-feature-card__icon">
                  <CheckSquare />
                </span>
                <div className="about-feature-card__text">
                  <strong>Plan clearly</strong>
                  <small>Turn busy days into clear next steps.</small>
                </div>
              </div>
              <div className="about-feature-card about-feature-card--purple">
                <span className="about-feature-card__icon">
                  <Clock3 />
                </span>
                <div className="about-feature-card__text">
                  <strong>Focus calmly</strong>
                  <small>Give important work your full attention.</small>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export function PrivacyLoadingState() {
  return (
    <div className="app-stage privacy-shell">
      <div className="device-frame privacy-frame" id="app-device-viewport">
        <main
          aria-label="Loading Privacy Policy"
          className="privacy-page exact-route-loading"
          id="main-content"
          role="status"
          tabIndex={0}
        >
          <span className="sr-only">Loading Privacy Policy</span>
          <header className="privacy-nav-header">
            <BackButton
              aria-label="Back"
              className="privacy-back-btn"
              fallbackHref="/sign-in"
            >
              <ArrowLeft />
            </BackButton>
            <div className="privacy-nav-title">
              <span className="privacy-nav-wordmark">Privacy Policy</span>
            </div>
            <div className="privacy-status-chip">
              <span aria-hidden="true" className="privacy-status-dot" />
              <span>Effective Aug 2026</span>
            </div>
          </header>

          <section className="privacy-hero-banner">
            <div aria-hidden="true" className="privacy-hero-banner__glow" />
            <div className="privacy-hero-banner__content">
              <div className="privacy-hero-meta">
                <span className="privacy-hero-badge">
                  <ShieldCheck />
                  <span>Privacy &amp; Data Protection</span>
                </span>
                <span className="privacy-hero-date">Effective 28 Aug 2026</span>
              </div>
              <p className="privacy-hero-banner__title">Privacy Policy</p>
              <p className="privacy-hero-banner__desc">
                This policy explains what Traketo collects, why it is needed,
                and the choices you have over your information.
              </p>
            </div>
          </section>

          <section
            aria-label="Core privacy promises"
            className="privacy-guarantees-banner"
          >
            <div className="privacy-guarantees-title">
              <ShieldCheck />
              <span>Our Privacy Guarantees</span>
            </div>
            <div className="privacy-guarantees-grid">
              <div className="privacy-guarantee-card privacy-guarantee-card--green">
                <span className="privacy-guarantee-card__icon">
                  <ShieldCheck />
                </span>
                <div className="privacy-guarantee-card__text">
                  <strong>Zero data selling</strong>
                  <small>No third-party advertising or profiling.</small>
                </div>
              </div>
              <div className="privacy-guarantee-card privacy-guarantee-card--blue">
                <span className="privacy-guarantee-card__icon">
                  <LockKeyhole />
                </span>
                <div className="privacy-guarantee-card__text">
                  <strong>Encrypted storage</strong>
                  <small>Hashed credentials &amp; encrypted data.</small>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export function TermsLoadingState() {
  return (
    <div
      aria-label="Loading Terms of Service"
      className="app-stage terms-shell exact-route-loading"
      role="status"
    >
      <div className="device-frame terms-frame" id="app-device-viewport">
        <main className="terms-page" id="main-content" tabIndex={0}>
          <header className="terms-nav-header">
            <BackButton
              aria-label="Back"
              className="terms-back-btn"
              fallbackHref="/sign-in"
            >
              <ArrowLeft />
            </BackButton>
            <div className="terms-nav-title">
              <span className="terms-nav-wordmark">Terms of Service</span>
            </div>
            <div className="terms-status-chip">
              <span aria-hidden="true" className="terms-status-dot" />
              <span>Agreement Active</span>
            </div>
          </header>

          <section className="terms-hero-banner">
            <div aria-hidden="true" className="terms-hero-banner__glow" />
            <div className="terms-hero-banner__content">
              <div className="terms-hero-meta">
                <span className="terms-hero-badge">
                  <Scale />
                  <span>User Agreement</span>
                </span>
                <span className="terms-hero-date">Effective 26 Aug 2026</span>
              </div>
              <p className="terms-hero-banner__title">Terms of Service</p>
              <p className="terms-hero-banner__desc">
                These terms set the ground rules for using Traketo and explain
                the responsibilities shared between you and the service.
              </p>
            </div>
          </section>

          <section
            aria-label="Core agreement principles"
            className="terms-pillars-banner"
          >
            <div className="terms-pillars-title">
              <FileCheck2 />
              <span>The Ground Rules at a Glance</span>
            </div>
            <div className="terms-pillars-grid">
              <div className="terms-pillar-card terms-pillar-card--blue">
                <div className="terms-pillar-card__icon">
                  <UserCheck />
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
                  <ShieldCheck />
                </div>
                <div className="terms-pillar-card__text">
                  <strong>Fair &amp; safe conduct</strong>
                  <small>
                    No abuse, security exploits, or harmful scraping.
                  </small>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export function PrivacyCentreLoadingState() {
  return (
    <div
      aria-label="Loading Privacy and Data Centre"
      className="app-stage privacy-centre-shell exact-route-loading"
      role="status"
    >
      <div
        className="device-frame privacy-centre-frame"
        id="app-device-viewport"
      >
        <main className="privacy-centre-page" id="main-content" tabIndex={0}>
          <header className="privacy-centre-nav-header">
            <BackButton
              aria-label="Back"
              className="privacy-centre-back-btn"
              fallbackHref="/settings"
            >
              <ArrowLeft />
            </BackButton>
            <div className="privacy-centre-nav-title">
              <span className="privacy-centre-nav-wordmark">
                Privacy &amp; Data Centre
              </span>
            </div>
            <div className="privacy-centre-status-chip">
              <span aria-hidden="true" className="privacy-centre-status-dot" />
              <span>Shield Active</span>
            </div>
          </header>

          <section className="privacy-centre-hero">
            <div aria-hidden="true" className="privacy-centre-hero__glow" />
            <div className="privacy-centre-hero__content">
              <div className="privacy-centre-hero__meta">
                <span className="privacy-centre-hero__badge">
                  <ShieldCheck />
                  <span>Data Protection &amp; Rights</span>
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  DPDP &amp; GDPR Compliant
                </span>
              </div>
              <p className="privacy-centre-hero__title">
                Privacy &amp; Data Centre
              </p>
              <p className="privacy-centre-hero__desc">
                Inspect the data Traketo holds, manage optional consent,
                download your archive, submit privacy requests, and designate a
                trusted nominee.
              </p>
            </div>
          </section>

          <div className="privacy-inventory-card">
            <div className="flex items-center gap-3">
              <div className="privacy-inventory-card__icon privacy-inventory-card__icon--blue">
                <Database />
              </div>
              <div>
                <strong>Loading data inventory…</strong>
                <p className="text-xs text-slate-500">
                  Retrieving held categories
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export function WorkspaceLoadingState() {
  return (
    <div
      aria-label="Loading workspace"
      className="grid gap-section exact-route-loading"
      role="status"
    >
      <span className="sr-only">Loading workspace</span>
      <PageHeading
        actions={<LoadingPlaceholder className="exact-loading__badge" />}
        as="h2"
        description="The explicit workspace URL passed the same membership-predicated access boundary used by every shell route."
        eyebrow="Authorized workspace"
        title="Opening workspace"
      />
      <Card className="border-border-soft bg-card/72 shadow-panel">
        <CardContent className="p-panel text-sm leading-7 text-ink-muted">
          This route remains an authorization diagnostic only. Workspace access
          is being verified.
        </CardContent>
      </Card>
    </div>
  )
}

function ManagementCreateCard({
  description,
  title,
}: Readonly<{
  description: string
  title: string
}>) {
  const fields = [
    ["List name", "input"],
    ["Accent", "select"],
    ["Description", "textarea"],
  ] as const

  return (
    <Card
      aria-hidden="true"
      className="border-border-soft bg-card/75 shadow-panel"
    >
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-control bg-system-blue/10 text-spectral-cyan">
            <PanelsTopLeft />
          </span>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-5">
          <div className="grid gap-4">
            {fields.map(([label, size]) => (
              <div className="grid gap-2" key={label}>
                <label>{label}</label>
                <LoadingPlaceholder
                  className={`exact-loading__management-${size}`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <LoadingPlaceholder className="exact-loading__management-submit" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ManagementSection({
  className,
  description,
  title,
}: Readonly<{
  className?: string
  description?: string
  title: string
}>) {
  return (
    <section aria-hidden="true" className={`grid gap-4 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-ink-muted">{description}</p>
          ) : null}
        </div>
        <LoadingPlaceholder className="exact-loading__count-label" />
      </div>
      <div className="grid gap-4 rounded-panel border border-border-soft bg-card/78 p-5 shadow-panel">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <LoadingPlaceholder className="exact-loading__dot" />
            <LoadingPlaceholder className="exact-loading__line exact-loading__line--title" />
          </div>
          <LoadingPlaceholder className="exact-loading__version" />
        </div>
        <LoadingPlaceholder className="exact-loading__line exact-loading__line--body" />
        <div className="flex gap-2 border-t border-border-soft pt-4">
          <LoadingPlaceholder className="exact-loading__small-action" />
          <LoadingPlaceholder className="exact-loading__small-action" />
        </div>
      </div>
    </section>
  )
}

function SettingsCard({
  className,
  description,
  icon,
  title,
}: Readonly<{
  className?: string
  description: string
  icon: "bell" | "download" | "shield"
  title: string
}>) {
  const Icon =
    icon === "bell" ? BellRing : icon === "download" ? Download : ShieldCheck

  return (
    <Card
      aria-hidden="true"
      className={`border-border-soft bg-card/75 shadow-panel ${className ?? ""}`}
    >
      <CardHeader>
        <div className="flex items-center gap-3">
          <Icon className="size-5 text-system-blue" />
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {title === "Reminder inbox" ? (
          <div className="grid gap-3">
            <p className="text-xs font-medium text-ink-muted">
              Checking unread alerts
            </p>
            <div className="grid justify-items-center gap-2 py-8 text-center text-ink-muted">
              <Inbox className="size-7" />
              <p className="text-sm font-medium text-ink">
                You&apos;re all caught up
              </p>
              <p className="max-w-sm text-xs leading-relaxed">
                Open tasks with less than 30 minutes remaining will appear here.
              </p>
            </div>
          </div>
        ) : title === "Task reminders" ? (
          <div className="grid gap-6">
            <p className="text-sm text-ink-muted">
              Checking which tasks can receive a reminder.
            </p>
            <div className="grid gap-3 border-t border-border-soft pt-5">
              <h2 className="flex items-center gap-2 font-semibold">
                <BellRing className="size-4" /> Reminder schedule
              </h2>
              <p className="flex items-center gap-2 text-sm text-ink-muted">
                <CalendarClock className="size-4" /> Loading scheduled reminders
              </p>
            </div>
          </div>
        ) : title === "Install and offline access" ? (
          <div className="grid gap-4">
            <div className="grid gap-3 text-sm text-ink-muted">
              <p>
                Install Traketo for app-like launching. Recent tasks and queued
                changes stay in private device storage and synchronize after
                reconnection.
              </p>
              <p className="text-xs">
                Checking the install options available on this device.
              </p>
            </div>
            <div className="grid gap-3">
              <p className="text-sm text-ink-muted">
                Offline storage is opt-in and encrypted with a device passcode.
              </p>
              <LoadingPlaceholder className="exact-loading__input" />
              <span className="inline-flex min-h-10 w-fit items-center gap-2 rounded-xl bg-system-blue px-4 font-semibold text-white opacity-70">
                <LockKeyhole className="size-4" /> Enable encrypted offline data
              </span>
            </div>
          </div>
        ) : title === "Legal and privacy" ? (
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border-soft bg-background px-4 py-2 font-semibold text-system-blue">
              <FileText className="size-4" /> Terms of Service
            </span>
            <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border-soft bg-background px-4 py-2 font-semibold text-system-blue">
              <ShieldCheck className="size-4" /> Privacy Policy
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
