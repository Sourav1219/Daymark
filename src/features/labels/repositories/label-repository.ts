import "server-only"

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm"

import type { DatabaseExecutor } from "@/db/client"
import {
  labels,
  questLabels,
  tasks,
  workspaceMembers,
  workspaces,
} from "@/db/schema"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import type { LabelColorToken } from "@/features/labels/domain/types"

export type LabelRecord = Readonly<{
  id: string
  name: string
  colorToken: LabelColorToken
  version: number
}>

export type CreateLabelRecord = Readonly<{
  name: string
  colorToken: LabelColorToken
}>

export type EditLabelRecord = CreateLabelRecord

const labelSelection = {
  colorToken: labels.colorToken,
  id: labels.id,
  name: labels.name,
  version: labels.version,
}

function labelIdentityPredicate(
  database: DatabaseExecutor,
  access: AccessContext,
  labelId: string,
) {
  return and(
    eq(labels.id, labelId),
    eq(labels.workspaceId, access.workspaceId),
    isNull(labels.deletedAt),
  )
}

export async function createLabelRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  input: CreateLabelRecord,
): Promise<LabelRecord | null> {
  // The insert only fires when the membership join yields a row, so a
  // fabricated or revoked AccessContext never persists a Label.
  const [created] = await database
    .insert(labels)
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
          name: sql<string>`${input.name}::varchar(60)`.as("name"),
          colorToken: sql<LabelColorToken>`${input.colorToken}::varchar(32)`.as(
            "color_token",
          ),
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
    .returning(labelSelection)

  return created ?? null
}

export async function listLabelRecords(
  database: DatabaseExecutor,
  access: AccessContext,
): Promise<readonly LabelRecord[]> {
  return database
    .select(labelSelection)
    .from(labels)
    .where(
      and(eq(labels.workspaceId, access.workspaceId), isNull(labels.deletedAt)),
    )
    .orderBy(asc(labels.name))
}

export async function findLabelRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  labelId: string,
): Promise<LabelRecord | null> {
  const [label] = await database
    .select(labelSelection)
    .from(labels)
    .where(labelIdentityPredicate(database, access, labelId))
    .limit(1)

  return label ?? null
}

async function updateLabelRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  labelId: string,
  expectedVersion: number,
  changes: Readonly<{
    colorToken?: LabelColorToken
    deletedAt?: Date | null
    name?: string
  }>,
): Promise<LabelRecord | null> {
  const [updated] = await database
    .update(labels)
    .set({
      ...changes,
      updatedAt: new Date(),
      version: sql`${labels.version} + 1`,
    })
    .where(
      and(
        labelIdentityPredicate(database, access, labelId),
        eq(labels.version, expectedVersion),
      ),
    )
    .returning(labelSelection)

  return updated ?? null
}

export function editLabelRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  input: EditLabelRecord & { expectedVersion: number; labelId: string },
): Promise<LabelRecord | null> {
  return updateLabelRecord(
    database,
    access,
    input.labelId,
    input.expectedVersion,
    {
      colorToken: input.colorToken,
      name: input.name,
    },
  )
}

export function softDeleteLabelRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  labelId: string,
  expectedVersion: number,
  deletedAt: Date,
): Promise<LabelRecord | null> {
  return updateLabelRecord(database, access, labelId, expectedVersion, {
    deletedAt,
  })
}

/**
 * Replaces the label assignments for a quest atomically.
 * Verifies all label IDs belong to the same workspace.
 */
export async function setQuestLabels(
  database: DatabaseExecutor,
  access: AccessContext,
  questId: string,
  expectedVersion: number,
  labelIds: readonly string[],
): Promise<number> {
  // Version-predicate the aggregate before changing its relationships.
  // The service transaction rolls this update back if validation fails.
  const [quest] = await database
    .update(tasks)
    .set({
      updatedAt: new Date(),
      version: sql`${tasks.version} + 1`,
    })
    .where(
      and(
        eq(tasks.id, questId),
        eq(tasks.workspaceId, access.workspaceId),
        eq(tasks.version, expectedVersion),
        isNull(tasks.deletedAt),
      ),
    )
    .returning({ version: tasks.version })

  if (!quest) {
    const [current] = await database
      .select({ version: tasks.version })
      .from(tasks)
      .where(
        and(
          eq(tasks.id, questId),
          eq(tasks.workspaceId, access.workspaceId),
          isNull(tasks.deletedAt),
        ),
      )
      .limit(1)

    throw new Error(current ? "QUEST_CONFLICT" : "QUEST_NOT_FOUND")
  }

  if (labelIds.length > 0) {
    const validLabels = await database
      .select({ id: labels.id })
      .from(labels)
      .where(
        and(
          inArray(labels.id, [...labelIds]),
          eq(labels.workspaceId, access.workspaceId),
          isNull(labels.deletedAt),
        ),
      )

    if (validLabels.length !== labelIds.length) {
      throw new Error("LABEL_NOT_FOUND")
    }
  }

  await database
    .delete(questLabels)
    .where(
      and(
        eq(questLabels.questId, questId),
        eq(questLabels.workspaceId, access.workspaceId),
      ),
    )

  if (labelIds.length > 0) {
    await database.insert(questLabels).values(
      labelIds.map((labelId) => ({
        createdByUserId: access.userId,
        labelId,
        questId,
        workspaceId: access.workspaceId,
      })),
    )
  }

  return quest.version
}

export async function deleteLabelAssignments(
  database: DatabaseExecutor,
  access: AccessContext,
  labelId: string,
): Promise<void> {
  await database
    .delete(questLabels)
    .where(
      and(
        eq(questLabels.labelId, labelId),
        eq(questLabels.workspaceId, access.workspaceId),
      ),
    )
}

/** Get all label IDs assigned to a quest */
export async function getQuestLabelIds(
  database: DatabaseExecutor,
  access: AccessContext,
  questId: string,
): Promise<readonly string[]> {
  const results = await database
    .select({ labelId: questLabels.labelId })
    .from(questLabels)
    .where(
      and(
        eq(questLabels.questId, questId),
        eq(questLabels.workspaceId, access.workspaceId),
      ),
    )

  return results.map((r) => r.labelId)
}
