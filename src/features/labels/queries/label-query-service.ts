import "server-only"

import { getDatabase, type Database } from "@/db/client"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { authorizeLabelAccess } from "@/features/labels/authorization/label-authorization"
import type { LabelView } from "@/features/labels/domain/types"
import {
  listLabelRecords,
  type LabelRecord,
} from "@/features/labels/repositories/label-repository"

type LabelQueryOptions = Readonly<{
  database?: Database
}>

function toLabelView(record: LabelRecord): LabelView {
  return {
    colorToken: record.colorToken,
    id: record.id,
    name: record.name,
    version: record.version,
  }
}

export async function getLabelList(
  access: AccessContext,
  options: LabelQueryOptions = {},
): Promise<readonly LabelView[]> {
  authorizeLabelAccess(access)
  const database = options.database ?? getDatabase()
  const records = await listLabelRecords(database, access)

  return records.map(toLabelView)
}
