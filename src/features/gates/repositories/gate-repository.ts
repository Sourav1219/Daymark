import "server-only"

import {
  and,
  asc,
  count,
  eq,
  exists,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm"

import type { DatabaseExecutor } from "@/db/client"
import { gates, tasks, workspaceMembers, workspaces } from "@/db/schema"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import type {
  GateAccentToken,
  GateListKind,
} from "@/features/gates/domain/types"

export type GateRecord = Readonly<{
  id: string
  name: string
  description: string
  accentToken: GateAccentToken
  position: number
  archivedAt: Date | null
  version: number
}>

export type GateWithCount = GateRecord & { questCount: number }

export type CreateGateRecord = Readonly<{
  name: string
  description: string
  accentToken: GateAccentToken
}>

export type EditGateRecord = CreateGateRecord

const gateSelection = {
  accentToken: gates.accentToken,
  archivedAt: gates.archivedAt,
  description: gates.description,
  id: gates.id,
  name: gates.name,
  position: gates.position,
  version: gates.version,
}

function activeAccessPredicate(
  database: DatabaseExecutor,
  access: AccessContext,
) {
  return exists(
    database
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(
        and(
          eq(workspaceMembers.userId, access.userId),
          eq(workspaceMembers.workspaceId, access.workspaceId),
          isNull(workspaceMembers.deletedAt),
          isNull(workspaces.deletedAt),
        ),
      ),
  )
}

function gateIdentityPredicate(
  database: DatabaseExecutor,
  access: AccessContext,
  gateId: string,
) {
  return and(
    eq(gates.id, gateId),
    eq(gates.workspaceId, access.workspaceId),
    isNull(gates.deletedAt),
    activeAccessPredicate(database, access),
  )
}

export async function createGateRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  input: CreateGateRecord,
): Promise<GateRecord | null> {
  // The insert only fires when the membership join yields a row, so a
  // fabricated or revoked AccessContext never persists a Gate.
  const [created] = await database
    .insert(gates)
    .select(
      database
        .select({
          id: sql<string>`gen_random_uuid()`.as("id"),
          workspaceId: sql<string>`${access.workspaceId}::uuid`.as(
            "workspace_id",
          ),
          createdByUserId: sql<string>`${access.userId}::uuid`.as(
            "created_by_user_id",
          ),
          name: sql<string>`${input.name}::varchar(120)`.as("name"),
          description: sql<string>`${input.description}::text`.as(
            "description",
          ),
          accentToken:
            sql<GateAccentToken>`${input.accentToken}::varchar(32)`.as(
              "accent_token",
            ),
          position: sql<number>`0::integer`.as("position"),
          archivedAt: sql<Date | null>`null::timestamptz`.as("archived_at"),
          createdAt: sql<Date>`now()`.as("created_at"),
          updatedAt: sql<Date>`now()`.as("updated_at"),
          deletedAt: sql<Date | null>`null::timestamptz`.as("deleted_at"),
          version: sql<number>`1::integer`.as("version"),
        })
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
        .where(
          and(
            eq(workspaceMembers.userId, access.userId),
            eq(workspaceMembers.workspaceId, access.workspaceId),
            isNull(workspaceMembers.deletedAt),
            isNull(workspaces.deletedAt),
          ),
        )
        .limit(1),
    )
    .returning(gateSelection)

  return created ?? null
}

export async function listGateRecords(
  database: DatabaseExecutor,
  access: AccessContext,
  kind: GateListKind,
): Promise<readonly GateWithCount[]> {
  const questCountSubquery = database
    .select({
      gateId: tasks.projectId,
      questCount: count().as("quest_count"),
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceId, access.workspaceId),
        isNotNull(tasks.projectId),
      ),
    )
    .groupBy(tasks.projectId)
    .as("quest_counts")

  const lifecycleFilter =
    kind === "archived" ? isNotNull(gates.archivedAt) : isNull(gates.archivedAt)

  const results = await database
    .select({
      ...gateSelection,
      questCount: sql<number>`coalesce(${questCountSubquery.questCount}, 0)::integer`,
    })
    .from(gates)
    .leftJoin(questCountSubquery, eq(questCountSubquery.gateId, gates.id))
    .where(
      and(
        eq(gates.workspaceId, access.workspaceId),
        isNull(gates.deletedAt),
        lifecycleFilter,
        activeAccessPredicate(database, access),
      ),
    )
    .orderBy(asc(gates.position), asc(gates.name))

  return results
}

export async function findGateRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  gateId: string,
): Promise<GateRecord | null> {
  const [gate] = await database
    .select(gateSelection)
    .from(gates)
    .where(gateIdentityPredicate(database, access, gateId))
    .limit(1)

  return gate ?? null
}

async function updateGateRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  gateId: string,
  expectedVersion: number,
  changes: Readonly<{
    accentToken?: GateAccentToken
    archivedAt?: Date | null
    deletedAt?: Date | null
    description?: string
    name?: string
  }>,
  archived?: boolean,
): Promise<GateRecord | null> {
  const [updated] = await database
    .update(gates)
    .set({
      ...changes,
      updatedAt: new Date(),
      version: sql`${gates.version} + 1`,
    })
    .where(
      and(
        gateIdentityPredicate(database, access, gateId),
        eq(gates.version, expectedVersion),
        archived === undefined
          ? undefined
          : archived
            ? isNotNull(gates.archivedAt)
            : isNull(gates.archivedAt),
      ),
    )
    .returning(gateSelection)

  return updated ?? null
}

export function editGateRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  input: EditGateRecord & { expectedVersion: number; gateId: string },
): Promise<GateRecord | null> {
  return updateGateRecord(
    database,
    access,
    input.gateId,
    input.expectedVersion,
    {
      accentToken: input.accentToken,
      description: input.description,
      name: input.name,
    },
  )
}

export function archiveGateRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  gateId: string,
  expectedVersion: number,
  archivedAt: Date,
): Promise<GateRecord | null> {
  return updateGateRecord(
    database,
    access,
    gateId,
    expectedVersion,
    { archivedAt },
    false,
  )
}

export function restoreGateRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  gateId: string,
  expectedVersion: number,
): Promise<GateRecord | null> {
  return updateGateRecord(
    database,
    access,
    gateId,
    expectedVersion,
    { archivedAt: null },
    true,
  )
}

export function softDeleteGateRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  gateId: string,
  expectedVersion: number,
  deletedAt: Date,
): Promise<GateRecord | null> {
  return updateGateRecord(database, access, gateId, expectedVersion, {
    deletedAt,
  })
}

/** Counts all recoverable Quests assigned to a Gate in this workspace. */
export async function countGateQuests(
  database: DatabaseExecutor,
  access: AccessContext,
  gateId: string,
): Promise<number> {
  const [result] = await database
    .select({ total: count() })
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, gateId),
        eq(tasks.workspaceId, access.workspaceId),
        activeAccessPredicate(database, access),
      ),
    )

  return result?.total ?? 0
}
