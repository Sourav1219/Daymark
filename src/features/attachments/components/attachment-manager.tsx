"use client"

import { useRef, useState, useTransition } from "react"
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  Paperclip,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

import { ConfirmationDialog } from "@/components/system/confirmation-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  deleteAttachmentAction,
  finalizeAttachmentUploadAction,
  requestAttachmentDownloadAction,
  requestAttachmentUploadAction,
} from "@/features/attachments/application/actions"
import {
  allowedAttachmentMimeTypes,
  maximumAttachmentBytes,
  type AllowedAttachmentMimeType,
  type AttachmentView,
} from "@/features/attachments/domain/types"

type AttachmentManagerProps = Readonly<{
  attachments: readonly AttachmentView[]
  canUpload: boolean
  questId: string
  storageAvailable: boolean
}>

function formatBytes(bytes: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    style: "unit",
    unit: bytes >= 1024 * 1024 ? "megabyte" : "kilobyte",
    unitDisplay: "short",
  }).format(bytes / (bytes >= 1024 * 1024 ? 1024 * 1024 : 1024))
}

function uploadFile(
  url: string,
  headers: Readonly<Record<string, string>>,
  file: File,
  onProgress: (percent: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open("PUT", url)
    for (const [name, value] of Object.entries(headers)) {
      request.setRequestHeader(name, value)
    }
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    })
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) resolve()
      else reject(new Error("R2 rejected the signed upload"))
    })
    request.addEventListener("error", () => reject(new Error("Upload failed")))
    request.addEventListener("abort", () =>
      reject(new Error("Upload cancelled")),
    )
    request.send(file)
  })
}

export function AttachmentManager({
  attachments: initialAttachments,
  canUpload,
  questId,
  storageAvailable,
}: AttachmentManagerProps) {
  const [attachments, setAttachments] = useState(initialAttachments)
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [feedback, setFeedback] = useState("")
  const [failed, setFailed] = useState(false)
  const [busy, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function fail(message: string) {
    setFailed(true)
    setProgress(null)
    setFeedback(message)
    toast.error(message)
  }

  function beginUpload() {
    if (!file || busy) return
    if (
      !allowedAttachmentMimeTypes.includes(
        file.type as AllowedAttachmentMimeType,
      ) ||
      file.size < 1 ||
      file.size > maximumAttachmentBytes
    ) {
      fail("Choose a PDF, JPEG, PNG, or WebP no larger than 10 MiB.")
      return
    }

    startTransition(async () => {
      setFailed(false)
      setProgress(0)
      setFeedback("Requesting a secure upload…")
      try {
        const grant = await requestAttachmentUploadAction({
          byteSize: file.size,
          mimeType: file.type,
          questId,
        })
        if (!grant.ok) return fail(grant.error.message)

        setAttachments((current) => [...current, grant.data.attachment])
        setFeedback("Uploading directly to private storage…")
        await uploadFile(
          grant.data.upload.url,
          grant.data.upload.headers,
          file,
          setProgress,
        )
        setProgress(100)
        setFeedback("Upload complete. Verifying file contents…")

        const finalized = await finalizeAttachmentUploadAction({
          attachmentId: grant.data.attachment.id,
        })
        if (!finalized.ok) {
          setAttachments((current) =>
            current.filter(({ id }) => id !== grant.data.attachment.id),
          )
          return fail(finalized.error.message)
        }

        setAttachments((current) =>
          current.map((attachment) =>
            attachment.id === finalized.data.id ? finalized.data : attachment,
          ),
        )
        setFile(null)
        setProgress(null)
        setFeedback(`${finalized.data.displayName} is ready.`)
        if (inputRef.current) inputRef.current.value = ""
        toast.success("Attachment verified and ready")
      } catch {
        fail("The attachment could not be uploaded. Choose the file and retry.")
      }
    })
  }

  function openAttachment(attachmentId: string) {
    startTransition(async () => {
      const result = await requestAttachmentDownloadAction({ attachmentId })
      if (!result.ok) return fail(result.error.message)

      const link = document.createElement("a")
      link.href = result.data.url
      link.rel = "noopener noreferrer"
      link.target = "_blank"
      link.click()
      setFeedback("Authorized attachment link opened in a new tab.")
    })
  }

  function removeAttachment(attachment: AttachmentView) {
    startTransition(async () => {
      const result = await deleteAttachmentAction({
        attachmentId: attachment.id,
        expectedVersion: attachment.version,
      })
      if (!result.ok) return fail(result.error.message)

      setAttachments((current) =>
        current.filter(({ id }) => id !== attachment.id),
      )
      setFeedback(`${attachment.displayName} was deleted.`)
      toast.success("Attachment deleted")
    })
  }

  if (!storageAvailable && attachments.length === 0) return null

  return (
    <section
      aria-label="Task attachments"
      className="grid gap-3 rounded-panel border border-border-soft bg-surface-inset/55 p-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Paperclip aria-hidden="true" className="size-4 text-spectral-cyan" />
          <h3 className="text-sm font-semibold">Attachments</h3>
        </div>
        <Badge variant="outline">{attachments.length}</Badge>
      </div>

      {attachments.length > 0 ? (
        <ul className="grid gap-2">
          {attachments.map((attachment) => (
            <li
              className="flex items-center justify-between gap-3 rounded-control border border-border-soft bg-card/70 p-2.5"
              key={attachment.id}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {attachment.displayName}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {attachment.status === "ready" && attachment.byteSize
                    ? formatBytes(attachment.byteSize)
                    : "Awaiting verification"}
                </p>
              </div>
              {attachment.status === "ready" ? (
                <div className="flex shrink-0 gap-1">
                  <Button
                    aria-label={`View ${attachment.displayName}`}
                    disabled={busy}
                    onClick={() => openAttachment(attachment.id)}
                    size="icon-sm"
                    variant="outline"
                  >
                    <ExternalLink aria-hidden="true" />
                  </Button>
                  <ConfirmationDialog
                    confirmLabel="Delete attachment"
                    description="The private object and its active metadata will be removed. This cannot be undone."
                    onConfirm={() => removeAttachment(attachment)}
                    title={`Delete ${attachment.displayName}?`}
                    triggerLabel="Delete attachment"
                    variant="destructive"
                  />
                </div>
              ) : (
                <LoaderCircle
                  aria-label="Attachment pending"
                  className="size-4 animate-spin text-ink-muted"
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-muted">No files attached.</p>
      )}

      {canUpload && storageAvailable ? (
        <div className="grid gap-2 border-t border-border-soft pt-3">
          <label
            className="text-xs font-medium"
            htmlFor={`attachment-${questId}`}
          >
            Add a private file
          </label>
          <input
            accept={allowedAttachmentMimeTypes.join(",")}
            className="block w-full text-xs text-ink-muted file:mr-3 file:rounded-control file:border file:border-border-strong file:bg-card file:px-3 file:py-2 file:text-xs file:font-medium file:text-ink"
            disabled={busy}
            id={`attachment-${questId}`}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null)
              setFailed(false)
              setFeedback("")
              setProgress(null)
            }}
            ref={inputRef}
            type="file"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ink-muted">
              PDF, JPEG, PNG, WebP · 10 MiB max
            </p>
            <Button disabled={!file || busy} onClick={beginUpload} size="sm">
              {busy ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <Upload aria-hidden="true" />
              )}
              {busy ? "Working" : "Upload"}
            </Button>
          </div>
        </div>
      ) : null}

      {progress !== null ? (
        <div className="grid gap-1.5">
          <div
            aria-label={`Upload progress: ${progress}%`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progress}
            className="h-2 overflow-hidden rounded-full bg-card"
            role="progressbar"
          >
            <div
              className="h-full bg-system-blue transition-[width] motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-mono text-xs text-ink-muted">{progress}%</span>
        </div>
      ) : null}

      <p
        aria-atomic="true"
        aria-live="polite"
        className={`flex items-center gap-2 text-xs ${
          failed ? "text-danger" : "text-ink-muted"
        }`}
        role={failed ? "alert" : "status"}
      >
        {feedback ? (
          failed ? (
            <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
          ) : (
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
          )
        ) : null}
        {feedback}
      </p>
    </section>
  )
}
