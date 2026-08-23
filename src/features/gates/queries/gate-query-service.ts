import "server-only"

import { getDatabase, type Database } from "@/db/client"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { authorizeGateAccess } from "@/features/gates/authorization/gate-authorization"
import type { GateListKind, GateView } from "@/features/gates/domain/types"
import {
  listGateRecords,
  type GateWithCount,
} from "@/features/gates/repositories/gate-repository"

type GateQueryOptions = Readonly<{
  database?: Database
}>

function toGateView(record: GateWithCount): GateView {
  return {
    accentToken: record.accentToken,
    archivedAt: record.archivedAt?.toISOString() ?? null,
    description: record.description,
    id: record.id,
    name: record.name,
    position: record.position,
    questCount: record.questCount,
    version: record.version,
  }
}

export async function getGateList(
  access: AccessContext,
  kind: GateListKind,
  options: GateQueryOptions = {},
): Promise<readonly GateView[]> {
  authorizeGateAccess(access)
  const database = options.database ?? getDatabase()
  const records = await listGateRecords(database, access, kind)

  return records.map(toGateView)
}
