import type { AllowedAttachmentMimeType } from "@/features/attachments/domain/types"

export type AttachmentObjectInspection = Readonly<{
  byteSize: number
  eTag: string
  prefix: Uint8Array
}>

export type AttachmentUploadGrant = Readonly<{
  headers: Readonly<Record<string, string>>
  url: string
}>

export interface AttachmentStorage {
  copyObject(
    input: Readonly<{
      contentType: AllowedAttachmentMimeType
      destinationKey: string
      sourceETag: string
      sourceKey: string
    }>,
  ): Promise<void>
  createDownloadUrl(
    input: Readonly<{
      contentType: AllowedAttachmentMimeType
      displayName: string
      key: string
    }>,
  ): Promise<string>
  createUploadGrant(
    input: Readonly<{
      contentType: AllowedAttachmentMimeType
      key: string
    }>,
  ): Promise<AttachmentUploadGrant>
  deleteObject(key: string): Promise<void>
  inspectObject(key: string): Promise<AttachmentObjectInspection>
}
