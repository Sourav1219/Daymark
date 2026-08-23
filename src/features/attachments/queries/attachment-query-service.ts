import "server-only"

import { getDatabase, type Database } from "@/db/client"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import type { AttachmentView } from "@/features/attachments/domain/types"
import { listAttachmentRecords } from "@/features/attachments/repositories/attachment-repository"
import { r2EnvFromServerEnv } from "@/lib/env/schema"
import { readServerEnv } from "@/lib/env/server"

export async function getAttachmentsByQuest(
  access: AccessContext,
  questIds: readonly string[],
  database: Database = getDatabase(),
) {
  const records = await listAttachmentRecords(database, access, questIds)
  const grouped: Record<string, AttachmentView[]> = {}

  for (const record of records) {
    if (record.status !== "pending" && record.status !== "ready") continue
    const list = grouped[record.questId] ?? []
    list.push({
      byteSize: record.byteSize,
      contentType: record.contentType,
      displayName: record.displayName,
      id: record.id,
      status: record.status,
      version: record.version,
    })
    grouped[record.questId] = list
  }

  return grouped as Readonly<Record<string, readonly AttachmentView[]>>
}

export function attachmentStorageAvailable() {
  return Boolean(r2EnvFromServerEnv(readServerEnv()))
}
