// @vitest-environment node

import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { createDatabase, type Database } from "@/db/client"
import {
  gates,
  labels,
  questLabels,
  tasks,
  users,
  workspaces,
} from "@/db/schema"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { maximumAttachmentBytes } from "@/features/attachments/domain/types"
import {
  cleanupAbandonedAttachments,
  deleteAttachment,
  finalizeAttachmentUpload,
  requestAttachmentDownload,
  requestAttachmentUpload,
} from "@/features/attachments/mutations/attachment-mutation-service"
import { getAttachmentsByQuest } from "@/features/attachments/queries/attachment-query-service"
import type {
  AttachmentObjectInspection,
  AttachmentStorage,
} from "@/features/attachments/storage/attachment-storage"
import { createQuest } from "@/features/quests/mutations/quest-mutation-service"
import { createQuestSchema } from "@/features/quests/validation/quest-validation"
import { provisionPersonalWorkspace } from "@/features/workspaces/application/provision-personal-workspace"
import { findWorkspaceAccess } from "@/features/workspaces/infrastructure/workspace-access-repository"
import { clearReminderFixtures } from "@/test/clear-reminder-fixtures"

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const integrationDescribe = testDatabaseUrl
  ? describe.sequential
  : describe.skip

class FakeAttachmentStorage implements AttachmentStorage {
  readonly objects = new Map<string, AttachmentObjectInspection>()
  lastUploadKey: string | null = null

  async copyObject({
    destinationKey,
    sourceETag,
    sourceKey,
  }: {
    destinationKey: string
    sourceETag: string
    sourceKey: string
  }) {
    const source = this.objects.get(sourceKey)
    if (!source || source.eTag !== sourceETag) throw new Error("copy mismatch")
    this.objects.set(destinationKey, { ...source, eTag: `copy-${source.eTag}` })
  }

  async createDownloadUrl({ key }: { key: string }) {
    if (!this.objects.has(key)) throw new Error("missing object")
    return `https://private-storage.test/${encodeURIComponent(key)}?signed=1`
  }

  async createUploadGrant({
    contentType,
    key,
  }: {
    contentType: string
    key: string
  }) {
    this.lastUploadKey = key
    return {
      headers: { "Content-Type": contentType },
      url: `https://private-storage.test/${encodeURIComponent(key)}?upload=1`,
    }
  }

  async deleteObject(key: string) {
    this.objects.delete(key)
  }

  async inspectObject(key: string) {
    const object = this.objects.get(key)
    if (!object) throw new Error("missing object")
    return object
  }
}

async function seedAccess(database: Database, label: string) {
  const userId = randomUUID()
  await database.insert(users).values({
    email: `attachment-${label}-${userId}@example.com`,
    id: userId,
    name: `${label} Attachment User`,
  })
  const workspaceId = await provisionPersonalWorkspace(database, {
    id: userId,
    name: `${label} Attachment User`,
  })
  const access = await findWorkspaceAccess(database, { userId, workspaceId })
  if (!access) throw new Error("Expected attachment fixture access")
  return access
}

const questCommand = createQuestSchema.parse({
  description: "Attachment integration Quest.",
  dueAt: "",
  priority: "medium",
  startAt: "",
  title: "Attachment Quest",
})

integrationDescribe("secure attachments", () => {
  let database: Database
  let first: AccessContext
  let second: AccessContext
  let storage: FakeAttachmentStorage

  beforeAll(() => {
    if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL is required")
    database = createDatabase(testDatabaseUrl)
  })

  beforeEach(async () => {
    await clearReminderFixtures(database)
    await database.delete(questLabels)
    await database.delete(tasks)
    await database.delete(labels)
    await database.delete(gates)
    await database.delete(workspaces)
    await database.delete(users)
    first = await seedAccess(database, "First")
    second = await seedAccess(database, "Second")
    storage = new FakeAttachmentStorage()
  })

  afterAll(async () => {
    if (database) await database.$client.end({ timeout: 2 })
  })

  it("uses randomized keys and authorizes ready metadata, downloads, and deletion", async () => {
    const quest = await createQuest(database, first, questCommand)
    const requestedAt = new Date("2026-08-09T10:00:00.000Z")
    const receipt = await requestAttachmentUpload(
      database,
      first,
      { byteSize: 5, mimeType: "application/pdf", questId: quest.id },
      storage,
      requestedAt,
    )
    expect(storage.lastUploadKey).toMatch(
      new RegExp(
        `^workspaces/${first.workspaceId}/quests/${quest.id}/staging/[0-9a-f-]{36}$`,
        "u",
      ),
    )
    expect(storage.lastUploadKey).not.toContain("pdf")
    storage.objects.set(storage.lastUploadKey!, {
      byteSize: 5,
      eTag: "pdf-etag",
      prefix: Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
    })

    const ready = await finalizeAttachmentUpload(
      database,
      first,
      { attachmentId: receipt.attachment.id },
      storage,
      new Date("2026-08-09T10:01:00.000Z"),
    )
    expect(ready).toMatchObject({
      byteSize: 5,
      contentType: "application/pdf",
      displayName: expect.stringMatching(/^attachment-[0-9a-f]{8}\.pdf$/u),
      status: "ready",
    })
    await expect(
      requestAttachmentDownload(
        database,
        second,
        { attachmentId: ready.id },
        storage,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(
      deleteAttachment(
        database,
        second,
        { attachmentId: ready.id, expectedVersion: ready.version },
        storage,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })

    await expect(
      requestAttachmentDownload(
        database,
        first,
        { attachmentId: ready.id },
        storage,
      ),
    ).resolves.toMatchObject({ url: expect.stringContaining("signed=1") })
    await expect(
      getAttachmentsByQuest(second, [quest.id], database),
    ).resolves.toEqual({})

    await deleteAttachment(
      database,
      first,
      { attachmentId: ready.id, expectedVersion: ready.version },
      storage,
      new Date("2026-08-09T10:02:00.000Z"),
    )
    expect(storage.objects.size).toBe(0)
    await expect(
      requestAttachmentDownload(
        database,
        first,
        { attachmentId: ready.id },
        storage,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("rejects spoofed and oversized stored objects after byte inspection", async () => {
    const quest = await createQuest(database, first, questCommand)
    const spoofed = await requestAttachmentUpload(
      database,
      first,
      { byteSize: 8, mimeType: "image/png", questId: quest.id },
      storage,
    )
    storage.objects.set(storage.lastUploadKey!, {
      byteSize: 8,
      eTag: "spoof-etag",
      prefix: new TextEncoder().encode("MZ fake!"),
    })
    await expect(
      finalizeAttachmentUpload(
        database,
        first,
        { attachmentId: spoofed.attachment.id },
        storage,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" })
    expect(storage.objects.size).toBe(0)

    const oversized = await requestAttachmentUpload(
      database,
      first,
      { byteSize: 4, mimeType: "image/jpeg", questId: quest.id },
      storage,
    )
    storage.objects.set(storage.lastUploadKey!, {
      byteSize: maximumAttachmentBytes + 1,
      eTag: "oversized-etag",
      prefix: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]),
    })
    await expect(
      finalizeAttachmentUpload(
        database,
        first,
        { attachmentId: oversized.attachment.id },
        storage,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" })
    expect(storage.objects.size).toBe(0)
  })

  it("cleans up abandoned pending uploads with a bounded worker", async () => {
    const quest = await createQuest(database, first, questCommand)
    const started = new Date("2026-08-09T10:00:00.000Z")
    await requestAttachmentUpload(
      database,
      first,
      { byteSize: 5, mimeType: "application/pdf", questId: quest.id },
      storage,
      started,
    )
    storage.objects.set(storage.lastUploadKey!, {
      byteSize: 5,
      eTag: "abandoned-etag",
      prefix: Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
    })

    await expect(
      cleanupAbandonedAttachments(
        database,
        storage,
        new Date("2026-08-09T10:16:00.000Z"),
        10,
      ),
    ).resolves.toEqual({ failed: 0, processed: 1, removed: 1 })
    expect(storage.objects.size).toBe(0)
  })
})
