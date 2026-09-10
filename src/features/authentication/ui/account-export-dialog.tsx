"use client"

import { useEffect, useRef, useState } from "react"
import {
  Check,
  Download,
  FileJson,
  FileText,
  LockKeyhole,
  PackageCheck,
  ShieldCheck,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  exportAccountDataAction,
  type ExportDataState,
} from "@/features/authentication/application/account-security-actions"
import {
  accountExportIncludedSections,
  accountExportSecurityExclusions,
} from "@/features/authentication/export/account-export-manifest"

type ExportPhase = "confirm" | "exporting" | "ready" | "error"
type ExportResult = Extract<ExportDataState, { ok: true }>["data"]

function downloadBase64File(file: {
  base64: string
  filename: string
  mimeType: string
}) {
  const binary = atob(file.base64)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: file.mimeType }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = file.filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function progressLabel(progress: number) {
  if (progress < 32) return "Collecting account and consent records"
  if (progress < 58) return "Gathering tasks, sessions, and workspaces"
  if (progress < 82) return "Adding shared-group and sharing information"
  return "Packaging your private archive"
}

export function AccountExportDialog() {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<ExportPhase>("confirm")
  const [includePdf, setIncludePdf] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ExportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isContentScrolling, setIsContentScrolling] = useState(false)
  const progressTimer = useRef<number | null>(null)
  const scrollHideTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (progressTimer.current !== null) {
        window.clearInterval(progressTimer.current)
      }
      if (scrollHideTimer.current !== null) {
        window.clearTimeout(scrollHideTimer.current)
      }
    },
    [],
  )

  function reset() {
    setPhase("confirm")
    setIncludePdf(false)
    setProgress(0)
    setResult(null)
    setError(null)
    setIsContentScrolling(false)
  }

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen && phase === "exporting") return
    setOpen(nextOpen)
    if (!nextOpen) reset()
  }

  async function startExport() {
    setError(null)
    setResult(null)
    setProgress(9)
    setPhase("exporting")
    progressTimer.current = window.setInterval(() => {
      setProgress((current) =>
        Math.min(88, current + Math.max(2, 9 - current / 15)),
      )
    }, 280)

    const response = await exportAccountDataAction({ includePdf }).catch(
      () => null,
    )

    if (progressTimer.current !== null) {
      window.clearInterval(progressTimer.current)
      progressTimer.current = null
    }

    if (!response?.ok) {
      setProgress(0)
      setError(
        response && !response.ok
          ? response.error.message
          : "The archive could not be prepared. Please try again.",
      )
      setPhase("error")
      return
    }

    setProgress(100)
    setResult(response.data)
    setPhase("ready")
  }

  const portalContainer =
    typeof document === "undefined"
      ? null
      : (document.getElementById("app-device-viewport") ?? document.body)

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          className="security-action-card__button"
          type="button"
          variant="outline"
        >
          <Download aria-hidden="true" />
          Request export
        </Button>
      </DialogTrigger>

      <DialogContent
        aria-describedby="account-export-description"
        className="account-export-dialog"
        onEscapeKeyDown={(event) => {
          if (phase === "exporting") event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (phase === "exporting") event.preventDefault()
        }}
        overlayClassName="account-export-dialog__overlay"
        portalContainer={portalContainer}
      >
        {phase === "confirm" ? (
          <>
            <div
              className={`account-export-dialog__scroll-shell${
                isContentScrolling ? " is-scrolling" : ""
              }`}
            >
              <div
                className="account-export-dialog__scroll-content"
                onScroll={() => {
                  setIsContentScrolling(true)
                  if (scrollHideTimer.current !== null) {
                    window.clearTimeout(scrollHideTimer.current)
                  }
                  scrollHideTimer.current = window.setTimeout(
                    () => setIsContentScrolling(false),
                    500,
                  )
                }}
              >
                <div className="account-export-dialog__hero">
                  <span className="account-export-dialog__hero-icon">
                    <PackageCheck aria-hidden="true" />
                  </span>
                  <div>
                    <span className="account-export-dialog__eyebrow">
                      Private account archive
                    </span>
                    <DialogTitle>Prepare your data export?</DialogTitle>
                    <DialogDescription id="account-export-description">
                      Review what will be included, choose a format, then
                      confirm once to build the archive.
                    </DialogDescription>
                  </div>
                </div>

                <section
                  aria-labelledby="account-export-includes"
                  className="account-export-dialog__section"
                >
                  <h4 id="account-export-includes">Included in your export</h4>
                  <ul className="account-export-dialog__included-list">
                    {accountExportIncludedSections.map((item) => (
                      <li key={item}>
                        <Check aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <fieldset className="account-export-dialog__formats">
                  <legend>Download format</legend>
                  <div className="account-export-dialog__format account-export-dialog__format--required">
                    <span>
                      <FileJson aria-hidden="true" />
                    </span>
                    <div>
                      <strong>JSON archive</strong>
                      <small>Complete, structured, and machine-readable</small>
                    </div>
                    <em>Included</em>
                  </div>
                  <label className="account-export-dialog__format">
                    <input
                      checked={includePdf}
                      onChange={(event) => setIncludePdf(event.target.checked)}
                      type="checkbox"
                    />
                    <span>
                      <FileText aria-hidden="true" />
                    </span>
                    <div>
                      <strong>PDF summary</strong>
                      <small>Optional readable companion document</small>
                    </div>
                    <i aria-hidden="true" />
                  </label>
                </fieldset>

                <details className="account-export-dialog__exclusions">
                  <summary>
                    <span>
                      <ShieldCheck aria-hidden="true" />
                    </span>
                    <div>
                      <strong>Sensitive security data is excluded</strong>
                      <small>See what is intentionally left out and why</small>
                    </div>
                  </summary>
                  <ul>
                    {accountExportSecurityExclusions.map((item) => (
                      <li key={item.category}>
                        <strong>{item.category}</strong>
                        <span>{item.details}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
              <span
                aria-hidden="true"
                className="account-export-dialog__scroll-indicator"
              />
            </div>

            <div className="account-export-dialog__actions">
              <Button
                onClick={() => changeOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button onClick={startExport} type="button">
                <LockKeyhole aria-hidden="true" />
                Prepare export
              </Button>
            </div>
          </>
        ) : null}

        {phase === "exporting" ? (
          <div className="account-export-dialog__status">
            <span className="account-export-dialog__spinner" aria-hidden="true">
              <PackageCheck />
            </span>
            <span className="account-export-dialog__eyebrow">
              Building archive
            </span>
            <DialogTitle>Your export is being prepared</DialogTitle>
            <DialogDescription id="account-export-description">
              Keep this window open. Your files stay private and will be ready
              to download here.
            </DialogDescription>
            <div
              aria-label="Export progress"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={Math.round(progress)}
              className="account-export-dialog__progress"
              role="progressbar"
            >
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="account-export-dialog__progress-copy">
              <span>{progressLabel(progress)}</span>
              <strong>{Math.round(progress)}%</strong>
            </div>
          </div>
        ) : null}

        {phase === "ready" && result ? (
          <>
            <div className="account-export-dialog__status account-export-dialog__status--ready">
              <div className="account-export-dialog__ready-hero">
                <span
                  className="account-export-dialog__ready-icon"
                  aria-hidden="true"
                >
                  <Check />
                </span>
                <span className="account-export-dialog__eyebrow">
                  Export ready
                </span>
                <DialogTitle>Your private archive is ready</DialogTitle>
                <DialogDescription id="account-export-description">
                  Your files were prepared securely and are ready to save.
                </DialogDescription>
              </div>

              <section
                aria-label="Export summary"
                className="account-export-dialog__summary"
              >
                <div className="account-export-dialog__summary-heading">
                  <span>Archive overview</span>
                  <small>Account-wide export</small>
                </div>
                <div className="account-export-dialog__summary-grid">
                  <span>
                    <strong>{result.summary.tasks}</strong>
                    <small>Tasks</small>
                  </span>
                  <span>
                    <strong>{result.summary.sessions}</strong>
                    <small>Sessions</small>
                  </span>
                  <span>
                    <strong>{result.summary.workspaces}</strong>
                    <small>Workspaces</small>
                  </span>
                  <span>
                    <strong>{result.summary.sharedGroups}</strong>
                    <small>Shared groups</small>
                  </span>
                  <span>
                    <strong>{result.summary.consentRecords}</strong>
                    <small>Consent records</small>
                  </span>
                </div>
              </section>

              <div
                aria-label="Files ready to download"
                className="account-export-dialog__ready-files"
              >
                <div className="account-export-dialog__ready-file">
                  <span aria-hidden="true">
                    <FileJson />
                  </span>
                  <div>
                    <strong>JSON archive</strong>
                    <small>Complete structured account data</small>
                  </div>
                  <em>Ready</em>
                </div>
                {result.pdf ? (
                  <div className="account-export-dialog__ready-file">
                    <span aria-hidden="true">
                      <FileText />
                    </span>
                    <div>
                      <strong>PDF summary</strong>
                      <small>Readable companion document</small>
                    </div>
                    <button
                      onClick={() => downloadBase64File(result.pdf!)}
                      type="button"
                    >
                      Download PDF
                    </button>
                  </div>
                ) : null}
              </div>

              <p className="account-export-dialog__privacy-note">
                <LockKeyhole aria-hidden="true" />
                Store this archive somewhere only you can access.
              </p>
            </div>

            <div className="account-export-dialog__actions account-export-dialog__ready-actions">
              <Button
                onClick={() => changeOpen(false)}
                type="button"
                variant="outline"
              >
                Done
              </Button>
              <Button
                onClick={() => downloadBase64File(result.json)}
                type="button"
              >
                <Download aria-hidden="true" />
                Download JSON
              </Button>
            </div>
          </>
        ) : null}

        {phase === "error" ? (
          <div className="account-export-dialog__status account-export-dialog__status--error">
            <span className="account-export-dialog__hero-icon">
              <LockKeyhole aria-hidden="true" />
            </span>
            <span className="account-export-dialog__eyebrow">
              Export interrupted
            </span>
            <DialogTitle>We couldn’t prepare the archive</DialogTitle>
            <DialogDescription id="account-export-description">
              {error}
            </DialogDescription>
            <div className="account-export-dialog__actions">
              <Button
                onClick={() => changeOpen(false)}
                type="button"
                variant="outline"
              >
                Close
              </Button>
              <Button onClick={startExport} type="button">
                Try again
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
