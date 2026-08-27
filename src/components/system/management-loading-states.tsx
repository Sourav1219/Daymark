import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  CalendarClock,
  ChevronDown,
  Clock3,
  Download,
  FileText,
  Inbox,
  LockKeyhole,
  Mail,
  MessageCircleMore,
  PanelsTopLeft,
  Send,
  ShieldCheck,
  Tags,
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
        description="Organise tasks into named Lists. Each List offers a shareable filtered view of your tasks, and archived Lists keep history without cluttering active work."
        eyebrow="Lists"
        title="Lists"
      />
      <ManagementCreateCard
        description="Group related tasks into a named, shareable view."
        icon="lists"
        kind="list"
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

export function LabelsLoadingState() {
  return (
    <div
      aria-label="Loading Labels"
      className="grid gap-section exact-route-loading"
      role="status"
    >
      <span className="sr-only">Loading Labels</span>
      <PageHeading
        actions={<LoadingPlaceholder className="exact-loading__badge" />}
        description="Create reusable Labels and attach them to tasks. Labels cut across Lists and schedules, and each one offers a shareable filtered view of your tasks."
        eyebrow="Labels"
        title="Labels"
      />
      <ManagementCreateCard
        description="Attach Labels to tasks to cut across Lists and schedules."
        icon="labels"
        kind="label"
        title="Create Label"
      />
      <ManagementSection title="Workspace Labels" />
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
    <div
      aria-label="Loading Contact us"
      className="contact-page exact-route-loading"
      role="status"
    >
      <span className="sr-only">Loading Contact us</span>
      <header className="contact-header">
        <BackButton aria-label="Back to profile" fallbackHref="/profile">
          <ArrowLeft />
        </BackButton>
        <div>
          <span>Help &amp; support</span>
          <h1>Contact us</h1>
        </div>
        <span aria-hidden="true" />
      </header>
      <section className="contact-hero">
        <span className="contact-hero__orb" />
        <span className="contact-hero__icon">
          <MessageCircleMore />
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
      <div aria-hidden="true" className="contact-form">
        <div className="contact-form__heading">
          <div>
            <span>Message details</span>
            <h2>Start a conversation</h2>
          </div>
          <Mail />
        </div>
        <label className="contact-field">
          <span>What do you need help with?</span>
          <span className="contact-select-wrap">
            <select disabled>
              <option>Account &amp; sign-in</option>
            </select>
            <ChevronDown />
          </span>
        </label>
        <label className="contact-field">
          <span>How can we help?</span>
          <textarea
            disabled
            placeholder="Share the details, what you expected, and anything you already tried…"
            rows={7}
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
          Please do not include passwords or verification codes. We’ll review
          your message as soon as possible.
        </p>
      </aside>
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
  icon,
  kind,
  title,
}: Readonly<{
  description: string
  icon: "labels" | "lists"
  kind: "label" | "list"
  title: string
}>) {
  const Icon = icon === "lists" ? PanelsTopLeft : Tags
  const fields =
    kind === "list"
      ? ([
          ["List name", "input"],
          ["Accent", "select"],
          ["Description", "textarea"],
        ] as const)
      : ([
          ["Label name", "input"],
          ["Color", "select"],
        ] as const)

  return (
    <Card
      aria-hidden="true"
      className="border-border-soft bg-card/75 shadow-panel"
    >
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-control bg-system-blue/10 text-spectral-cyan">
            <Icon />
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
