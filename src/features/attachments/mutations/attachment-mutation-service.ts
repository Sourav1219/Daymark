import "server-only"

import { randomUUID } from "node:crypto"

import type { Database, DatabaseExecutor } from "@/db/client"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { detectAllowedAttachmentMimeType } from "@/features/attachments/domain/file-signature"
import { AttachmentServiceError } from "@/features/attachments/domain/errors"
import {
  abandonedUploadLifetimeMilliseconds,
  attachmentExtension,
  maximumAttachmentBytes,
  uploadUrlLifetimeSeconds,
  type AttachmentView,
} from "@/features/attachments/domain/types"
import {
  createPendingAttachmentRecord,
  findAttachmentRecord,
  listAbandonedAttachmentRecords,
  markAbandonedAttachmentRemoved,
  markAttachmentDeleted,
  markAttachmentDeleting,
  markAttachmentFailed,
  markAttachmentReady,
  restoreAttachmentAfterDeleteFailure,
} from "@/features/attachments/repositories/attachment-repository"
import type { AttachmentStorage } from "@/features/attachments/storage/attachment-storage"
import type {
  AttachmentIdentityCommand,
  DeleteAttachmentCommand,
  RequestAttachmentUploadCommand,
} from "@/features/attachments/validation/attachment-validation"
import { findQuestRecord } from "@/features/quests/repositories/quest-repository"
import { lockWorkspaceForMutation } from "@/features/workspaces/infrastructure/workspace-access-repository"
import { logger } from "@/lib/observability/logger"
import { attachmentQuotaAvailable } from "@/lib/resource-quotas"

export type AttachmentUploadReceipt = Readonly<{
  attachment: AttachmentView
  expiresAt: string
  upload: Readonly<{
    headers: Readonly<Record<string, string>>
    url: string
  }>
}>

export type AttachmentDownloadReceipt = Readonly<{ url: string }>
export type AttachmentDeleteReceipt = Readonly<{ attachmentId: string }>

function toView(record: {
  byteSize: number | null
  contentType: AttachmentView["contentType"]
  displayName: string
  id: string
  status: string
  version: number
}): AttachmentView {
  if (record.status !== "pending" && record.status !== "ready") {
    throw new Error("Attachment cannot be presented in its current state")
  }

  return {
    byteSize: record.byteSize,
    contentType: record.contentType,
    displayName: record.displayName,
    id: record.id,
    status: record.status,
    version: record.version,
  }
}

async function withWorkspaceMutation<T>(
  database: Database,
  access: AccessContext,
  mutation: (transaction: DatabaseExecutor) => Promise<T>,
): Promise<T> {
  return database.transaction(async (transaction) => {
    if (!(await lockWorkspaceForMutation(transaction, access))) {
      throw new AttachmentServiceError(
        "FORBIDDEN",
        "Workspace access is no longer active.",
      )
    }

    return mutation(transaction)
  })
}

export async function requestAttachmentUpload(
  database: Database,
  access: AccessContext,
  command: RequestAttachmentUploadCommand,
  storage: AttachmentStorage,
  now: Date = new Date(),
): Promise<AttachmentUploadReceipt> {
  const quest = await findQuestRecord(database, access, command.questId)
  if (!quest) throw new AttachmentServiceError("NOT_FOUND", "Task not found.")

  const attachmentId = randomUUID()
  const storageKey = `workspaces/${access.workspaceId}/quests/${quest.id}/staging/${randomUUID()}`
  const upload = await storage.createUploadGrant({
    contentType: command.mimeType,
    key: storageKey,
  })
  const uploadExpiresAt = new Date(
    now.getTime() + abandonedUploadLifetimeMilliseconds,
  )
  const record = await withWorkspaceMutation(
    database,
    access,
    async (transaction) => {
      if (
        !(await attachmentQuotaAvailable(
          transaction,
          access.workspaceId,
          command.byteSize,
        ))
      ) {
        throw new AttachmentServiceError(
          "VALIDATION_ERROR",
          "This workspace has reached its attachment storage quota.",
        )
      }
      const currentQuest = await findQuestRecord(
        transaction,
        access,
        command.questId,
      )
      if (!currentQuest) {
        throw new AttachmentServiceError("NOT_FOUND", "Task not found.")
      }

      return createPendingAttachmentRecord(transaction, access, {
        expectedByteSize: command.byteSize,
        id: attachmentId,
        questId: currentQuest.id,
        requestedContentType: command.mimeType,
        storageKey,
        uploadExpiresAt,
      })
    },
  )

  return {
    attachment: toView(record),
    expiresAt: new Date(
      now.getTime() + uploadUrlLifetimeSeconds * 1000,
    ).toISOString(),
    upload,
  }
}

async function rejectUploadedObject(
  database: Database,
  access: AccessContext,
  storage: AttachmentStorage,
  record: Awaited<ReturnType<typeof findAttachmentRecord>> & {},
  failureCode: string,
  now: Date,
) {
  try {
    await storage.deleteObject(record.storageKey)
  } finally {
    await withWorkspaceMutation(database, access, (transaction) =>
      markAttachmentFailed(transaction, access, record.id, failureCode, now),
    )
  }
}

export async function finalizeAttachmentUpload(
  database: Database,
  access: AccessContext,
  command: AttachmentIdentityCommand,
  storage: AttachmentStorage,
  now: Date = new Date(),
): Promise<AttachmentView> {
  const record = await findAttachmentRecord(
    database,
    access,
    command.attachmentId,
  )
  if (!record) {
    throw new AttachmentServiceError("NOT_FOUND", "Attachment not found.")
  }
  if (record.status === "ready") return toView(record)
  if (record.status !== "pending") {
    throw new AttachmentServiceError(
      "CONFLICT",
      "Attachment is not waiting for an upload.",
    )
  }
  if (record.uploadExpiresAt <= now) {
    await rejectUploadedObject(
      database,
      access,
      storage,
      record,
      "upload_expired",
      now,
    )
    throw new AttachmentServiceError(
      "VALIDATION_ERROR",
      "The upload request expired. Choose the file again.",
    )
  }

  let inspection: Awaited<ReturnType<AttachmentStorage["inspectObject"]>>
  try {
    inspection = await storage.inspectObject(record.storageKey)
  } catch (error) {
    logger.error(
      "Attachment object inspection failed",
      error instanceof Error ? error : undefined,
      { attachment_id: record.id },
    )
    throw new AttachmentServiceError(
      "STORAGE_UNAVAILABLE",
      "The uploaded object could not be verified. Retry shortly.",
    )
  }
  const detectedType = detectAllowedAttachmentMimeType(inspection.prefix)
  const invalidSize =
    inspection.byteSize < 1 ||
    inspection.byteSize > maximumAttachmentBytes ||
    inspection.byteSize !== record.expectedByteSize

  if (invalidSize || !detectedType) {
    await rejectUploadedObject(
      database,
      access,
      storage,
      record,
      invalidSize ? "invalid_size" : "invalid_type",
      now,
    )
    throw new AttachmentServiceError(
      "VALIDATION_ERROR",
      invalidSize
        ? "The stored file size did not match the authorized upload."
        : "The file contents are not an allowed PDF, JPEG, PNG, or WebP.",
    )
  }

  const displayName = `attachment-${record.id.slice(0, 8)}.${attachmentExtension(detectedType)}`
  const permanentStorageKey = `workspaces/${access.workspaceId}/quests/${record.questId}/objects/${randomUUID()}`
  try {
    await storage.copyObject({
      contentType: detectedType,
      destinationKey: permanentStorageKey,
      sourceETag: inspection.eTag,
      sourceKey: record.storageKey,
    })
    const permanent = await storage.inspectObject(permanentStorageKey)
    if (
      permanent.byteSize !== inspection.byteSize ||
      detectAllowedAttachmentMimeType(permanent.prefix) !== detectedType
    ) {
      throw new Error("Promoted object verification failed")
    }
    await storage.deleteObject(record.storageKey)
  } catch (error) {
    logger.error(
      "Attachment object promotion failed",
      error instanceof Error ? error : undefined,
      { attachment_id: record.id },
    )
    try {
      await storage.deleteObject(permanentStorageKey)
    } catch (cleanupError) {
      logger.error(
        "Attachment promotion cleanup failed",
        cleanupError instanceof Error ? cleanupError : undefined,
        { attachment_id: record.id },
      )
      // The final key is random and has no metadata reference. A bucket
      // lifecycle rule is the last-resort cleanup if this removal fails.
    }
    throw new AttachmentServiceError(
      "STORAGE_UNAVAILABLE",
      "The uploaded object could not be secured. Retry shortly.",
    )
  }
  const ready = await withWorkspaceMutation(database, access, (transaction) =>
    markAttachmentReady(transaction, access, {
      attachmentId: record.id,
      byteSize: inspection.byteSize,
      contentType: detectedType,
      displayName,
      readyAt: now,
      storageKey: permanentStorageKey,
    }),
  )
  if (!ready) {
    await storage.deleteObject(permanentStorageKey)
    throw new AttachmentServiceError(
      "CONFLICT",
      "Attachment state changed before verification completed.",
    )
  }

  return toView(ready)
}

export async function requestAttachmentDownload(
  database: Database,
  access: AccessContext,
  command: AttachmentIdentityCommand,
  storage: AttachmentStorage,
): Promise<AttachmentDownloadReceipt> {
  const record = await findAttachmentRecord(
    database,
    access,
    command.attachmentId,
  )
  if (!record || record.status !== "ready" || !record.contentType) {
    throw new AttachmentServiceError("NOT_FOUND", "Attachment not found.")
  }

  return {
    url: await storage.createDownloadUrl({
      contentType: record.contentType,
      displayName: record.displayName,
      key: record.storageKey,
    }),
  }
}

export async function deleteAttachment(
  database: Database,
  access: AccessContext,
  command: DeleteAttachmentCommand,
  storage: AttachmentStorage,
  now: Date = new Date(),
): Promise<AttachmentDeleteReceipt> {
  const deleting = await withWorkspaceMutation(
    database,
    access,
    async (transaction) => {
      const current = await findAttachmentRecord(
        transaction,
        access,
        command.attachmentId,
      )
      if (!current) {
        throw new AttachmentServiceError("NOT_FOUND", "Attachment not found.")
      }
      const updated = await markAttachmentDeleting(
        transaction,
        access,
        current.id,
        command.expectedVersion,
        now,
      )
      if (!updated) {
        throw new AttachmentServiceError(
          "CONFLICT",
          "Attachment changed before it could be deleted.",
        )
      }
      return updated
    },
  )

  try {
    await storage.deleteObject(deleting.storageKey)
  } catch (error) {
    logger.error(
      "Attachment object deletion failed",
      error instanceof Error ? error : undefined,
      { attachment_id: deleting.id },
    )
    await withWorkspaceMutation(database, access, (transaction) =>
      restoreAttachmentAfterDeleteFailure(
        transaction,
        access,
        deleting.id,
        new Date(),
      ),
    )
    throw new AttachmentServiceError(
      "STORAGE_UNAVAILABLE",
      "Attachment storage could not complete the deletion. Retry shortly.",
    )
  }

  await withWorkspaceMutation(database, access, (transaction) =>
    markAttachmentDeleted(transaction, access, deleting.id, new Date()),
  )
  return { attachmentId: deleting.id }
}

export async function cleanupAbandonedAttachments(
  database: Database,
  storage: AttachmentStorage,
  now: Date = new Date(),
  limit = 50,
) {
  const records = await listAbandonedAttachmentRecords(
    database,
    {
      deletingBefore: new Date(
        now.getTime() - abandonedUploadLifetimeMilliseconds,
      ),
      now,
    },
    limit,
  )
  let removed = 0
  let failed = 0

  for (const record of records) {
    try {
      await storage.deleteObject(record.storageKey)
      await markAbandonedAttachmentRemoved(
        database,
        record.id,
        record.status,
        now,
      )
      removed += 1
    } catch (error) {
      logger.error(
        "Abandoned attachment cleanup failed",
        error instanceof Error ? error : undefined,
        { attachment_id: record.id },
      )
      failed += 1
    }
  }

  return { failed, processed: records.length, removed } as const
}
