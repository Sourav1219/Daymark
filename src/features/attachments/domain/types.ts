export const attachmentStatuses = [
  "pending",
  "ready",
  "deleting",
  "deleted",
  "failed",
] as const

export type AttachmentStatus = (typeof attachmentStatuses)[number]

export const allowedAttachmentMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

export type AllowedAttachmentMimeType =
  (typeof allowedAttachmentMimeTypes)[number]

export const maximumAttachmentBytes = 10 * 1024 * 1024
export const uploadUrlLifetimeSeconds = 5 * 60
export const downloadUrlLifetimeSeconds = 60
export const abandonedUploadLifetimeMilliseconds = 15 * 60 * 1000

export type AttachmentView = Readonly<{
  byteSize: number | null
  contentType: AllowedAttachmentMimeType | null
  displayName: string
  id: string
  status: "pending" | "ready"
  version: number
}>

export function attachmentExtension(mimeType: AllowedAttachmentMimeType) {
  switch (mimeType) {
    case "application/pdf":
      return "pdf"
    case "image/jpeg":
      return "jpg"
    case "image/png":
      return "png"
    case "image/webp":
      return "webp"
  }
}
