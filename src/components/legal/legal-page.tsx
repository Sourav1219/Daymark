"use client"

import type { Route } from "next"
import Link from "next/link"
import { ArrowLeft, FileCheck2, ShieldCheck } from "lucide-react"
import type { ReactNode } from "react"

import { BackButton } from "@/components/ui/back-button"
import { useLegalBackHref } from "@/components/legal/legal-shell-context"

const NUMBERED_SECTION_TITLE = /^(\d+)\.\s+(.+)$/

type LegalPageProps = Readonly<{
  children: ReactNode
  current: "privacy" | "terms"
  summary: string
  title: string
}>

export function LegalPage({
  children,
  current,
  summary,
  title,
}: LegalPageProps) {
  const backHref = useLegalBackHref()
  const isPrivacyPage = current === "privacy"
  const DocumentIcon = isPrivacyPage ? ShieldCheck : FileCheck2

  return (
    <main className="legal-shell">
      <div className="legal-frame">
        <header className="legal-header">
          <BackButton
            aria-label="Back to Traketo"
            className="legal-back"
            fallbackHref={backHref as Route}
          >
            <ArrowLeft aria-hidden="true" />
          </BackButton>
          <BackButton
            className="legal-wordmark"
            fallbackHref={backHref as Route}
          >
            <span aria-hidden="true" /> Traketo
          </BackButton>
          <span className="legal-header-label">Legal</span>
        </header>

        <div className="legal-content">
          <div className="legal-hero">
            <div className="legal-hero-meta">
              <span className="legal-kicker">
                <DocumentIcon aria-hidden="true" />
                {isPrivacyPage ? "Privacy & data" : "Terms & conditions"}
              </span>
              <span className="legal-date">Effective 26 Aug 2026</span>
            </div>
            <h1 className="legal-title">{title}</h1>
            <p className="legal-summary">{summary}</p>
            <nav aria-label="Legal documents" className="legal-tabs">
              <Link
                aria-current={current === "terms" ? "page" : undefined}
                href="/terms"
              >
                Terms
              </Link>
              <Link
                aria-current={current === "privacy" ? "page" : undefined}
                href="/privacy"
              >
                Privacy
              </Link>
            </nav>
          </div>

          <article className="legal-document">{children}</article>
        </div>
      </div>
    </main>
  )
}

export function LegalSection({
  children,
  title,
}: Readonly<{ children: ReactNode; title: string }>) {
  const titleParts = NUMBERED_SECTION_TITLE.exec(title)

  return (
    <section className="legal-section">
      <div className="legal-section-heading">
        {titleParts ? (
          <span aria-hidden="true" className="legal-section-number">
            {titleParts[1]}
          </span>
        ) : null}
        <h2 aria-label={title}>{titleParts?.[2] ?? title}</h2>
      </div>
      <div className="legal-section-body">{children}</div>
    </section>
  )
}
