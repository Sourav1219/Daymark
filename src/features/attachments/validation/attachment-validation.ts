import { z } from "zod"

import {
  allowedAttachmentMimeTypes,
  maximumAttachmentBytes,
} from "@/features/attachments/domain/types"

export const requestAttachmentUploadSchema = z.strictObject({
  byteSize: z.number().int().min(1).max(maximumAttachmentBytes),
  mimeType: z.enum(allowedAttachmentMimeTypes),
  questId: z.uuid(),
})

export const attachmentIdentitySchema = z.strictObject({
  attachmentId: z.uuid(),
})

export const deleteAttachmentSchema = attachmentIdentitySchema.extend({
  expectedVersion: z.number().int().positive(),
})

export type RequestAttachmentUploadCommand = z.infer<
  typeof requestAttachmentUploadSchema
>
export type AttachmentIdentityCommand = z.infer<typeof attachmentIdentitySchema>
export type DeleteAttachmentCommand = z.infer<typeof deleteAttachmentSchema>
