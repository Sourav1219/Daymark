"use server"

import { getDatabase } from "@/db/client"
import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { AttachmentServiceError } from "@/features/attachments/domain/errors"
import {
  deleteAttachment,
  finalizeAttachmentUpload,
  requestAttachmentDownload,
  requestAttachmentUpload,
  type AttachmentDeleteReceipt,
  type AttachmentDownloadReceipt,
  type AttachmentUploadReceipt,
} from "@/features/attachments/mutations/attachment-mutation-service"
import { createR2AttachmentStorage } from "@/features/attachments/storage/r2-attachment-storage"
import {
  attachmentIdentitySchema,
  deleteAttachmentSchema,
  requestAttachmentUploadSchema,
} from "@/features/attachments/validation/attachment-validation"
import {
  runActionMutation,
  validationFailure,
} from "@/lib/actions/action-helpers"
import type { ActionResult } from "@/lib/actions/action-result"
import { r2EnvFromServerEnv } from "@/lib/env/schema"
import { readServerEnv } from "@/lib/env/server"

const attachmentPaths = ["/quests", "/today", "/cleared"] as const

function storage() {
  const config = r2EnvFromServerEnv(readServerEnv())
  if (!config) {
    throw new AttachmentServiceError(
      "STORAGE_UNAVAILABLE",
      "Attachment storage is not configured.",
    )
  }
  return createR2AttachmentStorage(config)
}

function runAttachmentMutation<T>(
  userId: string,
  mutate: () => Promise<T>,
  paths: readonly string[] = attachmentPaths,
  policy: "attachment" | "attachmentUpload" = "attachment",
) {
  return runActionMutation({
    isExpectedError: (error): error is AttachmentServiceError =>
      error instanceof AttachmentServiceError,
    mutate,
    paths,
    rateLimit: { policy, userId },
    system: "Attachment",
  })
}

export async function requestAttachmentUploadAction(
  input: unknown,
): Promise<ActionResult<AttachmentUploadReceipt>> {
  const access = await requireWorkspaceAccess()
  const parsed = requestAttachmentUploadSchema.safeParse(input)
  if (!parsed.success) {
    return validationFailure(
      "Choose an allowed PDF, JPEG, PNG, or WebP up to 10 MiB.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runAttachmentMutation(
    access.userId,
    () =>
      requestAttachmentUpload(getDatabase(), access, parsed.data, storage()),
    [],
    "attachmentUpload",
  )
}

export async function finalizeAttachmentUploadAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof finalizeAttachmentUpload>>>> {
  const access = await requireWorkspaceAccess()
  const parsed = attachmentIdentitySchema.safeParse(input)
  if (!parsed.success) {
    return validationFailure(
      "The attachment upload receipt is invalid.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runAttachmentMutation(access.userId, () =>
    finalizeAttachmentUpload(getDatabase(), access, parsed.data, storage()),
  )
}

export async function requestAttachmentDownloadAction(
  input: unknown,
): Promise<ActionResult<AttachmentDownloadReceipt>> {
  const access = await requireWorkspaceAccess()
  const parsed = attachmentIdentitySchema.safeParse(input)
  if (!parsed.success) {
    return validationFailure(
      "The attachment reference is invalid.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runAttachmentMutation(
    access.userId,
    () =>
      requestAttachmentDownload(getDatabase(), access, parsed.data, storage()),
    [],
  )
}

export async function deleteAttachmentAction(
  input: unknown,
): Promise<ActionResult<AttachmentDeleteReceipt>> {
  const access = await requireWorkspaceAccess()
  const parsed = deleteAttachmentSchema.safeParse(input)
  if (!parsed.success) {
    return validationFailure(
      "The attachment deletion request is invalid.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runAttachmentMutation(access.userId, () =>
    deleteAttachment(getDatabase(), access, parsed.data, storage()),
  )
}
