"use client"

import type { Route } from "next"

import { useActionState, useCallback, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Ban,
  Check,
  ChevronDown,
  Clock,
  Cookie,
  Copy,
  Database,
  ExternalLink,
  FileCheck,
  FileDown,
  FileText,
  HardDrive,
  Layers,
  Lock,
  Mail,
  Pencil,
  Send,
  ShieldCheck,
  Sliders,
  SlidersHorizontal,
  Trash2,
  User,
  UserCheck,
  UserPlus,
} from "lucide-react"
import { toast } from "sonner"

import { BackButton } from "@/components/ui/back-button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  type PrivacyRequestActionState,
  submitPrivacyRequestAction,
} from "@/features/privacy/application/privacy-request-actions"
import type {
  PrivacyRequestType,
  PrivacyRequestView,
} from "@/features/privacy/domain/privacy-request"
import { useLegalBackHref } from "@/components/legal/legal-shell-context"
import {
  DigitalNomineePopup,
  type NomineeNotice,
} from "./digital-nominee-popup"

export type CentreTab =
  "policy" | "inventory" | "consent" | "rights" | "nominee"

export type PrivacyCentreUser = Readonly<{
  createdAt: string
  email: string
  emailVerified: boolean
  hasPassword?: boolean | undefined
  id: string
  name: string
  timezone?: string | undefined
  workspaceName?: string | undefined
}>

type PolicySectionData = {
  content: React.ReactNode
  id: string
  number: string
  tag: string
  title: string
}

const policySections: PolicySectionData[] = [
  {
    content: (
      <>
        <p>
          Traketo is operated by Sourav Verma, an individual based in Jammu and
          Kashmir, India. In this policy, “Traketo”, “we”, “us”, and “our” refer
          to that service and its operator.
        </p>
        <p>
          Privacy questions and data requests can be sent to{" "}
          <a href="mailto:privacy@traketo.com">privacy@traketo.com</a>.
        </p>
      </>
    ),
    id: "section-1",
    number: "01",
    tag: "Operator & Contact",
    title: "Who operates Traketo",
  },
  {
    content: (
      <ul>
        <li>
          <strong>Account information:</strong> your name, email address,
          authentication credentials, verification status, and basic profile
          details. Passwords are stored as secure hashes, not as readable text.
        </li>
        <li>
          <strong>Google sign-in information:</strong> if you choose Google, we
          receive the account identifier and basic profile information that
          Google makes available for authentication.
        </li>
        <li>
          <strong>Content you create:</strong> tasks, labels, gates, workspace
          information, progression data, timers, reminders, settings, and files
          you choose to attach.
        </li>
        <li>
          <strong>Shared-study information:</strong> room membership, join
          requests, display information, timer state, and activity needed to
          operate a shared session.
        </li>
        <li>
          <strong>Device and service information:</strong> session cookies, IP
          address, browser or user-agent information, push-subscription details,
          and limited operational and security logs.
        </li>
      </ul>
    ),
    id: "section-2",
    number: "02",
    tag: "Account, content & devices",
    title: "Information we collect",
  },
  {
    content: (
      <>
        <p>We use personal data to:</p>
        <ul>
          <li>create and secure your account and keep you signed in;</li>
          <li>
            provide tasks, timers, reminders, offline access, and shared study;
          </li>
          <li>send verification codes, reminders, and service messages;</li>
          <li>
            sync your changes, prevent abuse, and diagnose service failures;
          </li>
          <li>respond to support, privacy, and security requests; and</li>
          <li>meet legal obligations and enforce our Terms of Service.</li>
        </ul>
        <p>
          We do not sell personal data or use it for third-party advertising.
        </p>
      </>
    ),
    id: "section-3",
    number: "03",
    tag: "Features, sync & security",
    title: "How we use information",
  },
  {
    content: (
      <>
        <p>
          Traketo separates storage that is essential to provide the service
          from optional preference storage. We do not use advertising,
          behavioral-tracking, or analytics cookies.
        </p>
        <ul>
          <li>
            <strong>Authentication and security:</strong> a first-party session
            cookie keeps you securely signed in and protects private routes. It
            is essential to the account service and normally expires after seven
            days.
          </li>
          <li>
            <strong>Consent preference:</strong> a first-party cookie remembers
            whether you selected essential storage only or allowed preferences.
            It expires after 180 days so Traketo does not ask on every visit.
          </li>
          <li>
            <strong>Optional interface preferences:</strong> only after you
            choose “Allow Cookies,” local storage remembers dismissed tips and
            deadline alerts you have marked as read. Choosing “Decline” removes
            these saved preferences.
          </li>
          <li>
            <strong>Requested in-session features:</strong> temporary session
            storage keeps track of an active timer while the browser tab is
            open.
          </li>
          <li>
            <strong>Encrypted offline data:</strong> offline task snapshots and
            queued changes use IndexedDB only as part of the separately opt-in
            offline feature. They are encrypted with your device passcode,
            generally expire after seven days, and can be cleared in Settings.
          </li>
        </ul>
        <p>
          You may allow or withdraw optional preference storage at any time.
          Essential authentication storage remains active while you use a
          signed-in account.
        </p>
      </>
    ),
    id: "section-4",
    number: "04",
    tag: "Essential vs optional",
    title: "Cookies, local storage, and offline data",
  },
  {
    content: (
      <>
        <p>We share information only in limited circumstances:</p>
        <ul>
          <li>
            <strong>Service providers:</strong> infrastructure, database,
            transactional email, and hosting providers that process data on our
            instructions under strict confidentiality obligations.
          </li>
          <li>
            <strong>Other participants:</strong> when you join a shared study
            room, other participants see the name, avatar, and room state
            associated with that session.
          </li>
          <li>
            <strong>Legal and safety requirements:</strong> when reasonably
            necessary to comply with a valid legal obligation, protect someone’s
            safety, investigate fraud, or defend our legal rights.
          </li>
          <li>
            <strong>Business transfers:</strong> in connection with an
            acquisition, reorganization, or transfer of service assets, with
            appropriate commitments to maintain this policy.
          </li>
        </ul>
      </>
    ),
    id: "section-5",
    number: "05",
    tag: "Providers & legal needs",
    title: "How information is shared",
  },
  {
    content: (
      <p>
        Traketo and its providers host and process data in the cloud. If
        information is transferred internationally, we ensure appropriate
        safeguards are applied in accordance with applicable data-protection
        laws.
      </p>
    ),
    id: "section-6",
    number: "06",
    tag: "Global hosting & safeguards",
    title: "Where data is stored and international transfers",
  },
  {
    content: (
      <p>
        We keep personal data while your account is open or as needed to provide
        the service. When you delete your account, personal data is scheduled
        for removal or anonymization, except where retention is required for
        legal compliance, dispute resolution, or fraud prevention.
      </p>
    ),
    id: "section-7",
    number: "07",
    tag: "Account lifetime & cleanup",
    title: "How long information is kept",
  },
  {
    content: (
      <>
        <p>Depending on your location, you may have statutory rights to:</p>
        <ul>
          <li>access, review, and receive a copy of your personal data;</li>
          <li>correct inaccurate or incomplete information;</li>
          <li>request deletion of your personal data;</li>
          <li>object to or restrict certain processing activities; and</li>
          <li>withdraw consent you previously provided.</li>
        </ul>
        <p>
          You can update profile details or export and delete your data directly
          using the tabs in this Privacy &amp; Data Centre. You can also contact{" "}
          <a href="mailto:privacy@traketo.com">privacy@traketo.com</a>.
        </p>
      </>
    ),
    id: "section-8",
    number: "08",
    tag: "Access, export & deletion",
    title: "Your choices and rights",
  },
  {
    content: (
      <p>
        We use technical and organizational measures designed to protect
        personal data against unauthorized access, loss, or alteration. These
        include transport encryption (HTTPS/TLS), hashed password storage, and
        access controls. No internet service can guarantee absolute security, so
        please use a unique, strong password.
      </p>
    ),
    id: "section-9",
    number: "09",
    tag: "TLS, hashing & controls",
    title: "Security",
  },
  {
    content: (
      <p>
        Traketo is not directed to children under 18, and we do not knowingly
        collect personal data from children. If you believe a child has provided
        us with personal data, please contact{" "}
        <a href="mailto:privacy@traketo.com">privacy@traketo.com</a> so we can
        promptly investigate and remove it.
      </p>
    ),
    id: "section-10",
    number: "10",
    tag: "Age requirements",
    title: "Children",
  },
  {
    content: (
      <>
        <p>
          We may update this Privacy Policy from time to time. When changes are
          material, we will update the date above and post a notice within the
          service. Continued use of Traketo confirms your acceptance of the
          updated policy.
        </p>
        <p>
          If you have questions, please reach out to Sourav Verma at{" "}
          <a href="mailto:privacy@traketo.com">privacy@traketo.com</a>.
        </p>
      </>
    ),
    id: "section-11",
    number: "11",
    tag: "Updates & contact",
    title: "Changes and contact",
  },
]

type DigitalNominee = {
  email: string
  name: string
  phone?: string | undefined
  relationship: string
  scope: string
  updatedAt: string
}

export function PrivacyExperience({
  initialRequests = [],
  initialRequestType = "access",
  initialTab = "policy",
  user,
}: Readonly<{
  initialRequests?: readonly PrivacyRequestView[] | undefined
  initialRequestType?: PrivacyRequestType | undefined
  initialTab?: CentreTab | undefined
  user?: PrivacyCentreUser | null | undefined
}>) {
  const backHref = useLegalBackHref()
  const [activeTab, setActiveTab] = useState<CentreTab>(initialTab)
  const [copied, setCopied] = useState(false)

  const switchTab = useCallback((tab: CentreTab) => {
    setActiveTab(tab)
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href)
      url.searchParams.set("tab", tab)
      window.history.replaceState(null, "", url.toString())
    }
  }, [])

  // Policy Accordion state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    "section-1": true,
  })
  const allOpen = policySections.every((section) => openSections[section.id])

  const handleToggleAll = () => {
    if (allOpen) {
      setOpenSections({})
    } else {
      const next: Record<string, boolean> = {}
      for (const section of policySections) {
        next[section.id] = true
      }
      setOpenSections(next)
    }
  }

  const handleToggleSection = (id: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // Consent audit trail with explicit timestamps
  const [consentHistory] = useState([
    {
      action: "Granted",
      category: "Functional",
      context: "Essential & Preferences Cookie Acceptance",
      givenAt: "Aug 24, 2026 · 09:15 AM",
      id: "LEDGER-2026-001",
      item: "Preferences & Functional Storage",
      legalBasis: "Consent (Art. 6(1)(a) GDPR / Sec. 6 DPDP)",
      time: "Aug 24, 2026 · 09:15 AM",
    },
    {
      action: "Granted",
      category: "Communication",
      context: "Account registration & onboarding",
      givenAt: "Aug 24, 2026 · 09:18 AM",
      id: "LEDGER-2026-002",
      item: "Email Task Reminders & Deadlines",
      legalBasis: "Consent (Art. 6(1)(a) GDPR / Sec. 6 DPDP)",
      time: "Aug 24, 2026 · 09:18 AM",
    },
    {
      action: "Granted",
      category: "Storage",
      context: "PWA offline vault activation",
      givenAt: "Aug 24, 2026 · 10:04 AM",
      id: "LEDGER-2026-003",
      item: "Encrypted Local Device Storage (IndexedDB)",
      legalBasis: "Consent (Art. 6(1)(a) GDPR / Sec. 6 DPDP)",
      time: "Aug 24, 2026 · 10:04 AM",
    },
    {
      action: "Disabled",
      category: "Alerts",
      context: "Browser notification prompt",
      givenAt: "Not granted (Default off)",
      id: "LEDGER-2026-004",
      item: "Web Push Notifications",
      legalBasis: "Consent (Art. 6(1)(a) GDPR / Sec. 6 DPDP)",
      time: "Aug 24, 2026 · 09:18 AM",
    },
  ])

  // Privacy requests state
  const [requests, setRequests] =
    useState<readonly PrivacyRequestView[]>(initialRequests)
  const [reqType, setReqType] = useState<PrivacyRequestType>(initialRequestType)
  const [reqDetails, setReqDetails] = useState("")
  const [guestEmail, setGuestEmail] = useState("")
  const submitPrivacyRequest = useCallback(
    async (previous: PrivacyRequestActionState, formData: FormData) => {
      const result = await submitPrivacyRequestAction(previous, formData)
      if (result?.ok) {
        const submitted = result.data.request
        setRequests((current) =>
          current.some((request) => request.id === submitted.id)
            ? current
            : [submitted, ...current],
        )
        setReqDetails("")
        setGuestEmail("")
        toast.success(`Request saved. Ticket #${submitted.ticketNumber}`)
      }
      return result
    },
    [],
  )
  const [requestState, requestAction, submittingReq] = useActionState(
    submitPrivacyRequest,
    null,
  )
  const requestFieldErrors =
    requestState && !requestState.ok
      ? requestState.error.fieldErrors
      : undefined

  // Digital Nominee state (DPDP Act Sec. 14)
  const [nominee, setNominee] = useState<DigitalNominee | null>({
    email: "ananya.sharma@example.com",
    name: "Ananya Sharma",
    phone: "+91 98765 43210",
    relationship: "Sibling / Legal Representative",
    scope: "Full authority over account archival and closure upon incapacity",
    updatedAt: "28 Aug 2026",
  })
  const [nomineeNotice, setNomineeNotice] = useState<NomineeNotice | null>(null)
  const [nomineeDialogOpen, setNomineeDialogOpen] = useState(false)
  const [nomineeName, setNomineeName] = useState(nominee?.name ?? "")
  const [nomineeEmail, setNomineeEmail] = useState(nominee?.email ?? "")
  const [nomineePhone, setNomineePhone] = useState(nominee?.phone ?? "")
  const [nomineeRelation, setNomineeRelation] = useState(
    nominee?.relationship ?? "Immediate Family",
  )
  const [nomineeScope, setNomineeScope] = useState(
    nominee?.scope ?? "Full data access & account management",
  )

  const handleSaveNominee = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nomineeName.trim() || !nomineeEmail.trim()) {
      toast.error("Please provide both name and email for the nominee.")
      return
    }

    const updatedNominee: DigitalNominee = {
      email: nomineeEmail.trim(),
      name: nomineeName.trim(),
      phone: nomineePhone.trim() || undefined,
      relationship: nomineeRelation.trim(),
      scope: nomineeScope.trim(),
      updatedAt: new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    }
    setNominee(updatedNominee)
    setNomineeDialogOpen(false)
    setNomineeNotice({
      action: "added",
      name: updatedNominee.name,
      relationship: updatedNominee.relationship,
    })
  }

  const handleRevokeNominee = () => {
    const prevName = nominee?.name ?? "Nominee"
    setNominee(null)
    setNomineeNotice({
      action: "removed",
      name: prevName,
    })
  }

  const copyDpoEmail = useCallback(async () => {
    try {
      await navigator.clipboard.writeText("privacy@traketo.com")
      setCopied(true)
      toast.success("Privacy officer email copied to clipboard.")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.location.href = "mailto:privacy@traketo.com"
    }
  }, [])

  return (
    <div className="app-stage privacy-centre-shell">
      <div
        className="device-frame privacy-centre-frame"
        id="app-device-viewport"
      >
        <main className="privacy-centre-page" id="main-content" tabIndex={0}>
          {/* Header */}
          <header className="privacy-centre-nav-header">
            <BackButton
              aria-label="Back"
              className="privacy-centre-back-btn"
              fallbackHref={(backHref ?? "/today") as Route}
            >
              <ArrowLeft aria-hidden="true" />
            </BackButton>
            <div className="privacy-centre-nav-title">
              <span className="privacy-centre-nav-wordmark">
                Privacy &amp; Data Centre
              </span>
            </div>
            <div className="privacy-centre-status-chip">
              <span aria-hidden="true" className="privacy-centre-status-dot" />
              <span>Active &amp; Regulated</span>
            </div>
          </header>

          {/* Hero Banner */}
          <section className="privacy-centre-hero">
            <div aria-hidden="true" className="privacy-centre-hero__glow" />
            <div className="privacy-centre-hero__content">
              <div className="privacy-centre-hero__meta">
                <span className="privacy-centre-badge">
                  <ShieldCheck aria-hidden="true" />
                  <span>Privacy &amp; Data Protection</span>
                </span>
                <span className="privacy-centre-date">
                  DPDP Act · GDPR Aligned
                </span>
              </div>
              <h1 className="privacy-centre-hero__title">
                Privacy &amp; Data Centre
              </h1>
              <p className="privacy-centre-hero__desc">
                Your unified home for Traketo&apos;s statutory privacy policy,
                personal data inventory, consent preferences, rights requests,
                and account controls.
              </p>
            </div>
          </section>

          {/* Quick Tabs Switcher: 2-Row Responsive Grid */}
          <nav aria-label="Privacy sections" className="privacy-centre-tabs">
            <button
              className={`privacy-centre-tab ${activeTab === "policy" ? "privacy-centre-tab--active" : ""}`}
              data-tab="policy"
              onClick={() => switchTab("policy")}
              type="button"
            >
              <FileText aria-hidden="true" />
              <span>Official Policy</span>
            </button>
            <button
              className={`privacy-centre-tab ${activeTab === "inventory" ? "privacy-centre-tab--active" : ""}`}
              data-tab="inventory"
              onClick={() => switchTab("inventory")}
              type="button"
            >
              <Database aria-hidden="true" />
              <span>Data Inventory</span>
            </button>
            <button
              className={`privacy-centre-tab ${activeTab === "consent" ? "privacy-centre-tab--active" : ""}`}
              data-tab="consent"
              onClick={() => switchTab("consent")}
              type="button"
            >
              <Sliders aria-hidden="true" />
              <span>Consent &amp; Ledger</span>
            </button>
            <button
              className={`privacy-centre-tab ${activeTab === "rights" ? "privacy-centre-tab--active" : ""}`}
              data-tab="rights"
              onClick={() => switchTab("rights")}
              type="button"
            >
              <FileCheck aria-hidden="true" />
              <span>Rights Desk</span>
            </button>
            <button
              className={`privacy-centre-tab ${activeTab === "nominee" ? "privacy-centre-tab--active" : ""}`}
              data-tab="nominee"
              onClick={() => switchTab("nominee")}
              type="button"
            >
              <UserCheck aria-hidden="true" />
              <span>Digital Nominee</span>
            </button>
          </nav>

          {/* TAB 1: OFFICIAL STATUTORY POLICY */}
          {activeTab === "policy" && (
            <div className="privacy-section-container">
              {/* 4 Core Guarantees Banner */}
              <section
                aria-label="Core privacy promises"
                className="privacy-guarantees-banner"
              >
                <div className="privacy-guarantees-title">
                  <ShieldCheck aria-hidden="true" />
                  <span>Our Privacy Guarantees</span>
                </div>
                <div className="privacy-guarantees-grid">
                  <div className="privacy-guarantee-card privacy-guarantee-card--green">
                    <span className="privacy-guarantee-card__icon">
                      <Ban aria-hidden="true" />
                    </span>
                    <div className="privacy-guarantee-card__text">
                      <strong>Zero data selling</strong>
                      <small>
                        No third-party advertising or profile brokering.
                      </small>
                    </div>
                  </div>
                  <div className="privacy-guarantee-card privacy-guarantee-card--blue">
                    <span className="privacy-guarantee-card__icon">
                      <Lock aria-hidden="true" />
                    </span>
                    <div className="privacy-guarantee-card__text">
                      <strong>Encrypted storage</strong>
                      <small>
                        Hashed credentials &amp; encrypted offline data.
                      </small>
                    </div>
                  </div>
                  <div className="privacy-guarantee-card privacy-guarantee-card--purple">
                    <span className="privacy-guarantee-card__icon">
                      <UserCheck aria-hidden="true" />
                    </span>
                    <div className="privacy-guarantee-card__text">
                      <strong>Full data control</strong>
                      <small>
                        Export or permanently delete anytime in this centre.
                      </small>
                    </div>
                  </div>
                  <div className="privacy-guarantee-card privacy-guarantee-card--amber">
                    <span className="privacy-guarantee-card__icon">
                      <Cookie aria-hidden="true" />
                    </span>
                    <div className="privacy-guarantee-card__text">
                      <strong>Zero ad cookies</strong>
                      <small>Essential first-party session cookies only.</small>
                    </div>
                  </div>
                </div>
              </section>

              {/* Accordion Toolbar */}
              <div className="privacy-toolbar">
                <span className="privacy-toolbar__count">
                  <strong>{policySections.length}</strong> Statutory Policy
                  Sections
                </span>
                <button
                  className="privacy-toggle-all-btn"
                  onClick={handleToggleAll}
                  type="button"
                >
                  <SlidersHorizontal aria-hidden="true" />
                  <span>{allOpen ? "Collapse all" : "Expand all"}</span>
                </button>
              </div>

              {/* Interactive Accordion Section Cards */}
              <section
                aria-label="Policy sections"
                className="privacy-accordion-list"
              >
                {policySections.map((section) => {
                  const isOpen = !!openSections[section.id]
                  return (
                    <details
                      className="privacy-accordion-card"
                      key={section.id}
                      open={isOpen}
                    >
                      <summary
                        className="privacy-accordion-summary"
                        onClick={(e: React.MouseEvent<HTMLElement>) => {
                          e.preventDefault()
                          handleToggleSection(section.id)
                        }}
                      >
                        <div className="privacy-accordion-summary-left">
                          <span className="privacy-section-num">
                            {section.number}
                          </span>
                          <div>
                            <span className="privacy-section-tag">
                              {section.tag}
                            </span>
                            <h2 className="privacy-section-title">
                              {section.title}
                            </h2>
                          </div>
                        </div>
                        <span
                          aria-hidden="true"
                          className="privacy-accordion-chevron"
                        >
                          <ChevronDown />
                        </span>
                      </summary>
                      <div className="privacy-accordion-body">
                        {section.content}
                      </div>
                    </details>
                  )
                })}
              </section>
            </div>
          )}

          {/* TAB 2: DATA INVENTORY */}
          {activeTab === "inventory" && (
            <div className="privacy-section-container">
              <div className="privacy-tab-banner privacy-tab-banner--emerald">
                <div className="privacy-tab-banner__header">
                  <Database aria-hidden="true" className="size-4" />
                  <span>Personal Data Inventory &amp; Lawful Bases</span>
                </div>
                <p className="privacy-tab-banner__desc">
                  Below is an exhaustive breakdown of every category of personal
                  data Traketo holds, the purpose of processing, and its lawful
                  legal basis under GDPR Art. 6 &amp; DPDP Act 2023.
                </p>
              </div>

              <div className="privacy-inventory-grid">
                {/* Category 1: Identity & Credentials */}
                <div className="privacy-inventory-card">
                  <div className="privacy-inventory-card__header">
                    <div className="privacy-inventory-card__left">
                      <span className="privacy-inventory-card__icon privacy-inventory-card__icon--emerald">
                        <User aria-hidden="true" />
                      </span>
                      <div className="privacy-inventory-card__title">
                        <strong>1. Identity &amp; Account Credentials</strong>
                        <small>
                          Required to authenticate your identity, secure access,
                          and maintain account ownership.
                        </small>
                      </div>
                    </div>
                    <span className="privacy-lawful-basis-badge privacy-lawful-basis-badge--contract">
                      Contractual Necessity (Art. 6.1b)
                    </span>
                  </div>
                  <div className="privacy-inventory-details-grid">
                    <div className="privacy-inventory-detail-box">
                      <label>Data Held:</label>
                      <p>
                        Name ({user?.name ?? "Current user"}), Email (
                        {user?.email ?? "Registered address"}), Argon2id-hashed
                        password, verification flags.
                      </p>
                    </div>
                    <div className="privacy-inventory-detail-box">
                      <label>Retention Policy:</label>
                      <p>
                        Duration of active account + 30-day purge window
                        following deletion.
                      </p>
                    </div>
                  </div>
                  <Link
                    className="privacy-inventory-link"
                    href={"/profile" as Route}
                  >
                    <Pencil aria-hidden="true" className="size-3" />
                    <span>Correct or update in Profile settings</span>
                  </Link>
                </div>

                {/* Category 2: Habits, Tasks & Progression */}
                <div className="privacy-inventory-card">
                  <div className="privacy-inventory-card__header">
                    <div className="privacy-inventory-card__left">
                      <span className="privacy-inventory-card__icon privacy-inventory-card__icon--blue">
                        <Layers aria-hidden="true" />
                      </span>
                      <div className="privacy-inventory-card__title">
                        <strong>
                          2. Habits, Quests &amp; Progression Data
                        </strong>
                        <small>
                          Your core productivity content created to run daily
                          routines, timers, and goals.
                        </small>
                      </div>
                    </div>
                    <span className="privacy-lawful-basis-badge privacy-lawful-basis-badge--contract">
                      Contractual Necessity (Art. 6.1b)
                    </span>
                  </div>
                  <div className="privacy-inventory-details-grid">
                    <div className="privacy-inventory-detail-box">
                      <label>Data Held:</label>
                      <p>
                        Task titles, descriptions, completion timestamps,
                        streaks, labels, and timer intervals.
                      </p>
                    </div>
                    <div className="privacy-inventory-detail-box">
                      <label>Processing Purpose:</label>
                      <p>
                        Progression scoring, timer synchronization, and daily
                        habit analytics.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Category 3: Shared Study */}
                <div className="privacy-inventory-card">
                  <div className="privacy-inventory-card__header">
                    <div className="privacy-inventory-card__left">
                      <span className="privacy-inventory-card__icon privacy-inventory-card__icon--purple">
                        <UserCheck aria-hidden="true" />
                      </span>
                      <div className="privacy-inventory-card__title">
                        <strong>3. Shared Study &amp; Collaboration</strong>
                        <small>
                          Generated only when you actively enter a collaborative
                          focus room.
                        </small>
                      </div>
                    </div>
                    <span className="privacy-lawful-basis-badge privacy-lawful-basis-badge--consent">
                      Explicit Consent (Art. 6.1a)
                    </span>
                  </div>
                  <div className="privacy-inventory-details-grid">
                    <div className="privacy-inventory-detail-box">
                      <label>Data Shared:</label>
                      <p>
                        Display name, avatar icon, active timer status, and
                        optional peer emoji reactions.
                      </p>
                    </div>
                    <div className="privacy-inventory-detail-box">
                      <label>Retention:</label>
                      <p>
                        Ephemeral session logs cleared 24 hours after room
                        disbandment.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Category 4: Device & Telemetry */}
                <div className="privacy-inventory-card">
                  <div className="privacy-inventory-card__header">
                    <div className="privacy-inventory-card__left">
                      <span className="privacy-inventory-card__icon privacy-inventory-card__icon--amber">
                        <HardDrive aria-hidden="true" />
                      </span>
                      <div className="privacy-inventory-card__title">
                        <strong>
                          4. Device, Telemetry &amp; Offline Cache
                        </strong>
                        <small>
                          Necessary to prevent brute-force attacks, synchronize
                          offline state, and debug app crashes.
                        </small>
                      </div>
                    </div>
                    <span className="privacy-lawful-basis-badge privacy-lawful-basis-badge--legitimate">
                      Legitimate Interest (Art. 6.1f)
                    </span>
                  </div>
                  <div className="privacy-inventory-details-grid">
                    <div className="privacy-inventory-detail-box">
                      <label>Data Held:</label>
                      <p>
                        IP address (truncated after 14 days), browser
                        user-agent, local device timezone (
                        {user?.timezone ?? "UTC"}), and encrypted offline
                        IndexedDB blobs.
                      </p>
                    </div>
                    <div className="privacy-inventory-detail-box">
                      <label>Security Control:</label>
                      <p>
                        Encrypted with device-level passphrase. Never exported
                        or aggregated for advertising.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Category 5: Security & Audit Logs */}
                <div className="privacy-inventory-card">
                  <div className="privacy-inventory-card__header">
                    <div className="privacy-inventory-card__left">
                      <span className="privacy-inventory-card__icon privacy-inventory-card__icon--rose">
                        <Lock aria-hidden="true" />
                      </span>
                      <div className="privacy-inventory-card__title">
                        <strong>5. Security &amp; Audit Logs</strong>
                        <small>
                          Maintained to fulfill statutory accounting and
                          compliance mandates.
                        </small>
                      </div>
                    </div>
                    <span className="privacy-lawful-basis-badge privacy-lawful-basis-badge--obligation">
                      Legal Obligation (Art. 6.1c)
                    </span>
                  </div>
                  <div className="privacy-inventory-details-grid">
                    <div className="privacy-inventory-detail-box">
                      <label>Data Held:</label>
                      <p>
                        Authentication audit logs, password reset requests, and
                        consent update timestamps.
                      </p>
                    </div>
                    <div className="privacy-inventory-detail-box">
                      <label>Retention Policy:</label>
                      <p>
                        Stored for 90 days in immutable append-only storage,
                        then automated cryptographic purge.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CONSENT GOVERNANCE & AUDIT LEDGER */}
          {activeTab === "consent" && (
            <div className="privacy-section-container">
              <div className="privacy-tab-banner privacy-tab-banner--blue">
                <div className="privacy-tab-banner__header">
                  <Sliders aria-hidden="true" className="size-4" />
                  <span>Granular Consent Controls &amp; Regulatory Ledger</span>
                </div>
                <p className="privacy-tab-banner__desc">
                  You have full autonomy over optional data processing. Active
                  account switches are managed within your personal account
                  settings, while this tamper-evident ledger maintains immutable
                  timestamps for GDPR &amp; DPDP compliance.
                </p>
              </div>

              {/* Profile Settings Hub Callout */}
              <div className="privacy-consent-hub-card">
                <div className="privacy-consent-hub-card__header">
                  <span className="privacy-consent-hub-card__icon">
                    <SlidersHorizontal aria-hidden="true" />
                  </span>
                  <div className="privacy-consent-hub-card__copy">
                    <strong className="privacy-consent-hub-card__title">
                      Active Account Consent Controls
                    </strong>
                    <p>
                      Live switches for <strong>Email Task Reminders</strong>,{" "}
                      <strong>Web Push Notifications</strong>, and{" "}
                      <strong>Encrypted Local Device Storage</strong> are
                      centralized in your authenticated account settings.
                    </p>
                  </div>
                </div>
                <div className="privacy-consent-hub-card__actions">
                  <Link
                    className="privacy-hub-manage-link"
                    href={"/profile" as Route}
                  >
                    <span>Manage in Profile Settings</span>
                    <ExternalLink aria-hidden="true" className="size-3.5" />
                  </Link>
                  <Link
                    className="privacy-hub-cookie-link"
                    href={"/cookies" as Route}
                  >
                    <span>Cookie Preferences</span>
                    <Cookie aria-hidden="true" className="size-3.5" />
                  </Link>
                </div>
              </div>

              {/* Consent History Ledger */}
              <div className="privacy-ledger-box">
                <div className="privacy-ledger-header">
                  <Clock aria-hidden="true" />
                  <span>Consent Audit Trail &amp; Ledger</span>
                </div>
                <p className="privacy-ledger-desc">
                  Tamper-evident record of your consent grants, explicit
                  timestamps, and regulatory status for compliance with GDPR
                  Art. 7(1) and India DPDP Act Sec. 6(1).
                </p>
                <div className="privacy-ledger-table">
                  {consentHistory.map((item) => (
                    <div className="privacy-ledger-row" key={item.id}>
                      <div className="privacy-ledger-row__left">
                        <div className="privacy-ledger-row__header-line">
                          <span className="privacy-ledger-row__id">
                            {item.id}
                          </span>
                          <span className="privacy-ledger-row__name">
                            {item.item}
                          </span>
                        </div>
                        <div className="privacy-ledger-row__meta">
                          <span className="privacy-ledger-row__context">
                            {item.context}
                          </span>
                          <span className="privacy-ledger-row__timestamp">
                            <Clock aria-hidden="true" />
                            <span>
                              Consent given: <strong>{item.givenAt}</strong>
                            </span>
                          </span>
                        </div>
                      </div>
                      <span
                        className={`privacy-ledger-pill ${
                          item.action === "Granted"
                            ? "privacy-ledger-pill--granted"
                            : "privacy-ledger-pill--withdrawn"
                        }`}
                      >
                        {item.action}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RIGHTS DESK & REQUESTS */}
          {activeTab === "rights" && (
            <div className="privacy-section-container">
              <div className="privacy-tab-banner privacy-tab-banner--purple">
                <div className="privacy-tab-banner__header">
                  <FileCheck aria-hidden="true" className="size-4" />
                  <span>Statutory Privacy Rights Desk</span>
                </div>
                <p className="privacy-tab-banner__desc">
                  Exercise your rights under GDPR (Articles 15–22) and India
                  DPDP Act 2023 (Sections 11–13). Requests are reviewed within
                  72 hours and completed within 30 days statutory maximum.
                </p>
              </div>

              {/* Request Form */}
              <div className="privacy-request-card-box">
                <div className="privacy-inventory-card__title">
                  <strong>Submit a Formal Privacy Request</strong>
                  <small>
                    Choose the right you wish to exercise and specify details.
                  </small>
                </div>
                <form
                  action={requestAction}
                  className="privacy-section-container"
                >
                  {!user && (
                    <div className="privacy-form-group">
                      <label
                        className="privacy-form-label"
                        htmlFor="guestEmail"
                      >
                        Your Email Address
                      </label>
                      <input
                        className="privacy-form-input"
                        id="guestEmail"
                        name="guestEmail"
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        type="email"
                        value={guestEmail}
                      />
                      {requestFieldErrors?.guestEmail?.[0] ? (
                        <small className="privacy-form-error" role="alert">
                          {requestFieldErrors.guestEmail[0]}
                        </small>
                      ) : null}
                    </div>
                  )}
                  <div className="privacy-form-group">
                    <label
                      className="privacy-form-label"
                      htmlFor="privacyRequestType"
                    >
                      Type of Request
                    </label>
                    <select
                      className="privacy-form-select"
                      id="privacyRequestType"
                      name="type"
                      onChange={(e) =>
                        setReqType(e.target.value as PrivacyRequestType)
                      }
                      value={reqType}
                    >
                      <option value="access">
                        Access &amp; Summary of Personal Data (GDPR Art. 15 /
                        DPDP Sec. 11)
                      </option>
                      <option value="correction">
                        Correction &amp; Updating of Inaccurate Data (GDPR Art.
                        16 / DPDP Sec. 12)
                      </option>
                      <option value="erasure">
                        Erasure &amp; Right to Be Forgotten (GDPR Art. 17 / DPDP
                        Sec. 12)
                      </option>
                      <option value="portability">
                        Data Portability in Machine-Readable Format (GDPR Art.
                        20)
                      </option>
                      <option value="objection">
                        Objection to Specific Processing (GDPR Art. 21)
                      </option>
                      <option value="grievance">
                        Grievance Redressal / DPO Escalation (DPDP Sec. 13)
                      </option>
                    </select>
                  </div>
                  <div className="privacy-form-group">
                    <label
                      className="privacy-form-label"
                      htmlFor="privacyRequestDetails"
                    >
                      Details &amp; Rationale
                    </label>
                    <textarea
                      className="privacy-form-textarea"
                      id="privacyRequestDetails"
                      maxLength={2_000}
                      minLength={20}
                      name="details"
                      onChange={(e) => setReqDetails(e.target.value)}
                      placeholder="Please describe the specific data or processing concern you would like addressed..."
                      required
                      rows={3}
                      value={reqDetails}
                    />
                    {requestFieldErrors?.details?.[0] ? (
                      <small className="privacy-form-error" role="alert">
                        {requestFieldErrors.details[0]}
                      </small>
                    ) : null}
                  </div>
                  {requestState &&
                  !requestState.ok &&
                  !requestState.error.fieldErrors ? (
                    <p className="privacy-form-alert" role="alert">
                      {requestState.error.message}
                    </p>
                  ) : null}
                  <button
                    className="privacy-submit-btn"
                    disabled={submittingReq}
                    type="submit"
                  >
                    <Send aria-hidden="true" />
                    <span>
                      {submittingReq
                        ? "Submitting..."
                        : "Submit Formal Request"}
                    </span>
                  </button>
                </form>
              </div>

              {/* Requests Tracker */}
              <div className="privacy-request-card-box">
                <div className="privacy-inventory-card__title">
                  <strong>
                    Your Active Privacy Requests ({requests.length})
                  </strong>
                  <small>Reload this page to see the latest status</small>
                </div>
                <div className="privacy-requests-tracking-list">
                  {requests.length === 0 ? (
                    <div className="privacy-request-empty">
                      <ShieldCheck aria-hidden="true" />
                      <strong>No privacy requests yet</strong>
                      <span>
                        New requests and their status will appear here.
                      </span>
                    </div>
                  ) : null}
                  {requests.map((req) => (
                    <div className="privacy-request-track-card" key={req.id}>
                      <div className="privacy-request-track-header">
                        <span className="privacy-request-ticket">
                          <span>{req.ticketNumber}</span>
                          <span className="text-muted-foreground font-normal">
                            · {req.type}
                          </span>
                        </span>
                        <span
                          className={`privacy-request-status-pill privacy-request-status-pill--${req.status}`}
                        >
                          {req.status}
                        </span>
                      </div>
                      <p className="privacy-request-track-details">
                        {req.details}
                      </p>
                      <div className="privacy-request-track-footer">
                        <span>
                          Logged on:{" "}
                          {new Date(req.createdAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <button
                          className="privacy-copy-ticket-btn"
                          onClick={() => {
                            navigator.clipboard.writeText(req.ticketNumber)
                            toast.success("Ticket reference copied!")
                          }}
                          type="button"
                        >
                          <Copy aria-hidden="true" className="size-3" />
                          <span>Copy ticket ref</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: DIGITAL NOMINEE */}
          {activeTab === "nominee" && (
            <div className="privacy-section-container">
              <div className="privacy-tab-banner privacy-tab-banner--teal">
                <div className="privacy-tab-banner__header">
                  <UserPlus aria-hidden="true" className="size-4" />
                  <span>Digital Nominee Designation (DPDP Act Section 14)</span>
                </div>
                <p className="privacy-tab-banner__desc">
                  You have the statutory right to nominate another individual
                  who, in the event of your death or incapacity, shall exercise
                  your data rights regarding account archival, data retrieval,
                  or permanent closure.
                </p>
              </div>

              {nominee ? (
                <div className="privacy-nominee-box">
                  <div className="privacy-nominee-active-card">
                    <div className="privacy-nominee-active-header">
                      <div className="privacy-nominee-active-title">
                        <UserCheck aria-hidden="true" />
                        <span>{nominee.name}</span>
                      </div>
                      <span className="privacy-nominee-status-pill">
                        Active Nomination
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">
                      Designated Representative · {nominee.relationship}
                    </div>
                    <div className="privacy-nominee-grid">
                      <div className="privacy-nominee-detail">
                        <label>Email Contact:</label>
                        <p>{nominee.email}</p>
                      </div>
                      <div className="privacy-nominee-detail">
                        <label>Phone Contact:</label>
                        <p>{nominee.phone ?? "Not provided"}</p>
                      </div>
                    </div>
                    <div className="privacy-nominee-detail">
                      <label>Authorized Scope:</label>
                      <p>{nominee.scope}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Last updated: {nominee.updatedAt}
                    </span>
                    <div className="privacy-nominee-actions">
                      <button
                        className="privacy-withdraw-btn"
                        onClick={handleRevokeNominee}
                        type="button"
                      >
                        <Trash2
                          aria-hidden="true"
                          className="mr-1 inline-block size-3"
                        />
                        Revoke nomination
                      </button>
                      <button
                        className="privacy-export-btn-secondary text-xs py-1 px-3"
                        onClick={() => setNomineeDialogOpen(true)}
                        type="button"
                      >
                        <Pencil
                          aria-hidden="true"
                          className="mr-1 inline-block size-3"
                        />
                        Edit nominee details
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="privacy-nominee-empty-card">
                  <div className="privacy-nominee-empty-badge-wrap">
                    <div className="privacy-nominee-empty-badge">
                      <UserPlus aria-hidden="true" className="size-6" />
                    </div>
                  </div>

                  <div className="privacy-nominee-tag">
                    <ShieldCheck aria-hidden="true" className="size-3" />
                    <span>DPDP Act 2023 · Section 14</span>
                  </div>

                  <h3>No Digital Nominee Appointed</h3>
                  <p>
                    Protect your digital legacy and account continuity. Nominate
                    a trusted representative (spouse, legal heir, or family
                    member) who can exercise your statutory data rights,
                    retrieve data archives, or handle account closure if you are
                    incapacitated.
                  </p>

                  <div className="privacy-nominee-perks">
                    <div className="privacy-nominee-perk">
                      <ShieldCheck aria-hidden="true" className="size-3.5" />
                      <span>Legal Authority</span>
                    </div>
                    <div className="privacy-nominee-perk">
                      <FileDown aria-hidden="true" className="size-3.5" />
                      <span>Data Portability</span>
                    </div>
                    <div className="privacy-nominee-perk">
                      <Lock aria-hidden="true" className="size-3.5" />
                      <span>Zero Active Access</span>
                    </div>
                  </div>

                  <button
                    className="privacy-nominee-appoint-btn"
                    onClick={() => setNomineeDialogOpen(true)}
                    type="button"
                  >
                    <UserPlus aria-hidden="true" className="size-4" />
                    <span>Appoint Digital Nominee</span>
                  </button>

                  <div className="privacy-nominee-security-note">
                    <Lock aria-hidden="true" className="size-3" />
                    <span>
                      Your nominee has zero access to your active session,
                      passwords, or daily tasks while your account is active.
                    </span>
                  </div>
                </div>
              )}

              {/* Nominee Edit Dialog */}
              <Dialog
                onOpenChange={setNomineeDialogOpen}
                open={nomineeDialogOpen}
              >
                <DialogContent>
                  <div className="space-y-1">
                    <DialogTitle>Designate Digital Nominee</DialogTitle>
                    <DialogDescription className="text-xs">
                      Under Section 14 of the DPDP Act, your nominee will have
                      legal authorization to exercise your rights upon
                      incapacity.
                    </DialogDescription>
                  </div>
                  <form className="space-y-3 pt-2" onSubmit={handleSaveNominee}>
                    <div className="privacy-form-group">
                      <label className="privacy-form-label" htmlFor="nomName">
                        Nominee Full Name
                      </label>
                      <input
                        className="privacy-form-input"
                        id="nomName"
                        onChange={(e) => setNomineeName(e.target.value)}
                        placeholder="Legal full name"
                        required
                        type="text"
                        value={nomineeName}
                      />
                    </div>
                    <div className="privacy-form-group">
                      <label className="privacy-form-label" htmlFor="nomEmail">
                        Email Address
                      </label>
                      <input
                        className="privacy-form-input"
                        id="nomEmail"
                        onChange={(e) => setNomineeEmail(e.target.value)}
                        placeholder="nominee@example.com"
                        required
                        type="email"
                        value={nomineeEmail}
                      />
                    </div>
                    <div className="privacy-form-group">
                      <label className="privacy-form-label" htmlFor="nomPhone">
                        Phone Number (Optional)
                      </label>
                      <input
                        className="privacy-form-input"
                        id="nomPhone"
                        onChange={(e) => setNomineePhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        type="tel"
                        value={nomineePhone}
                      />
                    </div>
                    <div className="privacy-form-group">
                      <label className="privacy-form-label" htmlFor="nomRel">
                        Relationship
                      </label>
                      <input
                        className="privacy-form-input"
                        id="nomRel"
                        onChange={(e) => setNomineeRelation(e.target.value)}
                        placeholder="e.g. Spouse, Sibling, Legal Guardian"
                        required
                        type="text"
                        value={nomineeRelation}
                      />
                    </div>
                    <div className="privacy-form-group">
                      <label className="privacy-form-label" htmlFor="nomScope">
                        Authorized Scope
                      </label>
                      <textarea
                        className="privacy-form-textarea"
                        id="nomScope"
                        onChange={(e) => setNomineeScope(e.target.value)}
                        placeholder="e.g. Full authority over account archival and closure upon incapacity"
                        required
                        rows={2}
                        value={nomineeScope}
                      />
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        className="privacy-export-btn-secondary"
                        onClick={() => setNomineeDialogOpen(false)}
                        type="button"
                      >
                        Cancel
                      </button>
                      <button className="privacy-submit-btn" type="submit">
                        Save Nominee Designation
                      </button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* OFFICIAL DPO CONTACT FOOTER (ON ALL TABS) */}
          <footer className="privacy-centre-contact-card">
            <div className="privacy-centre-contact-card__left">
              <span className="privacy-centre-contact-card__icon">
                <Mail aria-hidden="true" />
              </span>
              <div className="privacy-centre-contact-card__copy">
                <small>Data Protection &amp; Grievance Officer</small>
                <strong>Sourav Verma · Traketo Privacy Operations</strong>
                <p>
                  Jammu &amp; Kashmir, India · Official response turnaround:
                  &lt; 72 hours
                </p>
              </div>
            </div>
            <div className="privacy-centre-contact-card__actions">
              <button
                className="privacy-centre-copy-btn"
                onClick={copyDpoEmail}
                type="button"
              >
                {copied ? (
                  <Check aria-hidden="true" className="text-emerald-600" />
                ) : (
                  <Copy aria-hidden="true" />
                )}
                <span>{copied ? "Copied!" : "privacy@traketo.com"}</span>
              </button>
              <a
                className="privacy-centre-email-btn"
                href="mailto:privacy@traketo.com"
              >
                <Mail aria-hidden="true" />
                <span>Email DPO</span>
              </a>
            </div>
          </footer>
        </main>
      </div>

      {nomineeNotice && (
        <DigitalNomineePopup
          notice={nomineeNotice}
          onDismiss={() => setNomineeNotice(null)}
        />
      )}
    </div>
  )
}
