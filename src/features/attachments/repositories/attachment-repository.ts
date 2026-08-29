import "server-only"

import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm"

import type { DatabaseExecutor } from "@/db/client"
import { attachments } from "@/db/schema"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import type {
  AllowedAttachmentMimeType,
  AttachmentStatus,
} from "@/features/attachments/domain/types"

export type AttachmentRecord = Readonly<{
  byteSize: number | null
  contentType: AllowedAttachmentMimeType | null
  deletedAt: Date | null
  displayName: string
  expectedByteSize: number
  failureCode: string | null
  id: string
  questId: string
  requestedContentType: AllowedAttachmentMimeType
  status: AttachmentStatus
  storageKey: string
  uploadExpiresAt: Date
  version: number
  workspaceId: string
}>

const attachmentSelection = {
  byteSize: attachments.byteSize,
  contentType: attachments.contentType,
  deletedAt: attachments.deletedAt,
  displayName: attachments.displayName,
  expectedByteSize: attachments.expectedByteSize,
  failureCode: attachments.failureCode,
  id: attachments.id,
  questId: attachments.questId,
  requestedContentType: attachments.requestedContentType,
  status: attachments.status,
  storageKey: attachments.storageKey,
  uploadExpiresAt: attachments.uploadExpiresAt,
  version: attachments.version,
  workspaceId: attachments.workspaceId,
}

const attachmentListSelection = {
  byteSize: attachments.byteSize,
  contentType: attachments.contentType,
  displayName: attachments.displayName,
  id: attachments.id,
  questId: attachments.questId,
  status: attachments.status,
  version: attachments.version,
}

export async function createPendingAttachmentRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  input: Readonly<{
    expectedByteSize: number
    id: string
    questId: string
    requestedContentType: AllowedAttachmentMimeType
    storageKey: string
    uploadExpiresAt: Date
  }>,
): Promise<AttachmentRecord> {
  const [created] = await database
    .insert(attachments)
    .values({
      expectedByteSize: input.expectedByteSize,
      id: input.id,
      questId: input.questId,
      requestedContentType: input.requestedContentType,
      storageKey: input.storageKey,
      uploadExpiresAt: input.uploadExpiresAt,
      uploadedByUserId: access.userId,
      workspaceId: access.workspaceId,
    })
    .returning(attachmentSelection)

  if (!created) throw new Error("Unable to create attachment metadata")
  return created
}

export async function findAttachmentRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  attachmentId: string,
): Promise<AttachmentRecord | null> {
  const [record] = await database
    .select(attachmentSelection)
    .from(attachments)
    .where(
      and(
        eq(attachments.id, attachmentId),
        eq(attachments.workspaceId, access.workspaceId),
        isNull(attachments.deletedAt),
      ),
    )
    .limit(1)

  return record ?? null
}

export function listAttachmentRecords(
  database: DatabaseExecutor,
  access: AccessContext,
  questIds?: readonly string[],
) {
  if (questIds?.length === 0) return Promise.resolve([])

  return database
    .select(attachmentListSelection)
    .from(attachments)
    .where(
      and(
        eq(attachments.workspaceId, access.workspaceId),
        questIds ? inArray(attachments.questId, [...questIds]) : undefined,
        inArray(attachments.status, ["pending", "ready"]),
        isNull(attachments.deletedAt),
      ),
    )
    .orderBy(asc(attachments.createdAt))
}

export async function markAttachmentReady(
  database: DatabaseExecutor,
  access: AccessContext,
  input: Readonly<{
    attachmentId: string
    byteSize: number
    contentType: AllowedAttachmentMimeType
    displayName: string
    readyAt: Date
    storageKey: string
  }>,
): Promise<AttachmentRecord | null> {
  const [updated] = await database
    .update(attachments)
    .set({
      byteSize: input.byteSize,
      contentType: input.contentType,
      displayName: input.displayName,
      readyAt: input.readyAt,
      status: "ready",
      storageKey: input.storageKey,
      updatedAt: input.readyAt,
      version: sql`${attachments.version} + 1`,
    })
    .where(
      and(
        eq(attachments.id, input.attachmentId),
        eq(attachments.workspaceId, access.workspaceId),
        eq(attachments.status, "pending"),
        isNull(attachments.deletedAt),
      ),
    )
    .returning(attachmentSelection)

  return updated ?? null
}

export async function markAttachmentFailed(
  database: DatabaseExecutor,
  access: AccessContext,
  attachmentId: string,
  failureCode: string,
  now: Date,
) {
  const [updated] = await database
    .update(attachments)
    .set({
      deletedAt: now,
      failureCode,
      status: "failed",
      updatedAt: now,
      version: sql`${attachments.version} + 1`,
    })
    .where(
      and(
        eq(attachments.id, attachmentId),
        eq(attachments.workspaceId, access.workspaceId),
        eq(attachments.status, "pending"),
        isNull(attachments.deletedAt),
      ),
    )
    .returning({ id: attachments.id })

  return Boolean(updated)
}

export async function markAttachmentDeleting(
  database: DatabaseExecutor,
  access: AccessContext,
  attachmentId: string,
  expectedVersion: number,
  now: Date,
) {
  const [updated] = await database
    .update(attachments)
    .set({
      status: "deleting",
      updatedAt: now,
      version: sql`${attachments.version} + 1`,
    })
    .where(
      and(
        eq(attachments.id, attachmentId),
        eq(attachments.workspaceId, access.workspaceId),
        eq(attachments.version, expectedVersion),
        eq(attachments.status, "ready"),
        isNull(attachments.deletedAt),
      ),
    )
    .returning(attachmentSelection)

  return updated ?? null
}

export function restoreAttachmentAfterDeleteFailure(
  database: DatabaseExecutor,
  access: AccessContext,
  attachmentId: string,
  now: Date,
) {
  return database
    .update(attachments)
    .set({
      status: "ready",
      updatedAt: now,
      version: sql`${attachments.version} + 1`,
    })
    .where(
      and(
        eq(attachments.id, attachmentId),
        eq(attachments.workspaceId, access.workspaceId),
        eq(attachments.status, "deleting"),
        isNull(attachments.deletedAt),
      ),
    )
}

export function markAttachmentDeleted(
  database: DatabaseExecutor,
  access: AccessContext,
  attachmentId: string,
  now: Date,
) {
  return database
    .update(attachments)
    .set({
      deletedAt: now,
      status: "deleted",
      updatedAt: now,
      version: sql`${attachments.version} + 1`,
    })
    .where(
      and(
        eq(attachments.id, attachmentId),
        eq(attachments.workspaceId, access.workspaceId),
        eq(attachments.status, "deleting"),
        isNull(attachments.deletedAt),
      ),
    )
}

export function listAbandonedAttachmentRecords(
  database: DatabaseExecutor,
  timing: Readonly<{ deletingBefore: Date; now: Date }>,
  limit: number,
) {
  return database
    .select(attachmentSelection)
    .from(attachments)
    .where(
      and(
        isNull(attachments.deletedAt),
        or(
          and(
            eq(attachments.status, "pending"),
            lt(attachments.uploadExpiresAt, timing.now),
          ),
          and(
            eq(attachments.status, "deleting"),
            lt(attachments.updatedAt, timing.deletingBefore),
          ),
        ),
      ),
    )
    .orderBy(asc(attachments.uploadExpiresAt))
    .limit(limit)
}

export function markAbandonedAttachmentRemoved(
  database: DatabaseExecutor,
  attachmentId: string,
  status: AttachmentStatus,
  now: Date,
) {
  return database
    .update(attachments)
    .set({
      deletedAt: now,
      failureCode: status === "pending" ? "upload_expired" : null,
      status: status === "pending" ? "failed" : "deleted",
      updatedAt: now,
      version: sql`${attachments.version} + 1`,
    })
    .where(
      and(
        eq(attachments.id, attachmentId),
        eq(attachments.status, status),
        isNull(attachments.deletedAt),
      ),
    )
}

/**
 * Total promoted attachment bytes across the deployment. Staging rows and
 * soft-deleted rows are excluded so the figure tracks retained storage.
 */
export async function sumRetainedAttachmentBytes(
  database: DatabaseExecutor,
): Promise<number> {
  const [row] = await database
    .select({
      totalBytes: sql<number | null>`coalesce(sum(${attachments.byteSize}), 0)`,
    })
    .from(attachments)
    .where(and(isNull(attachments.deletedAt), isNotNull(attachments.byteSize)))

  return row?.totalBytes ?? 0
}
