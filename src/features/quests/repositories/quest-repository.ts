import "server-only"

import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm"

import type { DatabaseExecutor } from "@/db/client"
import {
  gates,
  labels,
  questLabels,
  tasks,
  workspaceMembers,
  workspaces,
} from "@/db/schema"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { maxSubquestDepth } from "@/features/quests/domain/subquest-depth"
import type {
  QuestLabelBadge,
  QuestListKind,
  QuestPriority,
  QuestStatus,
} from "@/features/quests/domain/types"

export type QuestRecord = Readonly<{
  id: string
  title: string
  description: string
  status: QuestStatus
  priority: QuestPriority
  position: number
  startAt: Date | null
  dueAt: Date | null
  recurrenceOccurrenceAt: Date | null
  recurrenceRule: string | null
  recurrenceSequence: number | null
  recurrenceSeriesId: string | null
  recurrenceTimezone: string | null
  offlineMutationId: string | null
  xpReward: number
  completedAt: Date | null
  deletedAt: Date | null
  version: number
  projectId: string | null
  parentTaskId: string | null
}>

export type QuestListItem = QuestRecord &
  Readonly<{
    gateName: string | null
    subquestCount: number
  }>

export type QuestParentRecord = Readonly<{
  id: string
  parentTaskId: string | null
  title: string
}>

export type QuestOrderRecord = Readonly<{
  id: string
  position: number
  version: number
}>

export type CreateQuestRecord = Readonly<{
  title: string
  description: string
  priority: QuestPriority
  startAt: Date | null
  dueAt: Date | null
  projectId: string | null
  parentTaskId: string | null
  recurrenceOccurrenceAt: Date | null
  recurrenceRule: string | null
  recurrenceSequence: number | null
  recurrenceSeriesId: string | null
  recurrenceTimezone: string | null
  offlineMutationId?: string | null
}>

export type EditQuestRecord = CreateQuestRecord

export type QuestListSort =
  "manual" | "due-soonest" | "due-latest" | "priority" | "recently-updated"

export type QuestListOptions = Readonly<{
  dayEnd?: Date
  dayStart?: Date
  deletedAfter?: Date
  dueAfter?: Date
  dueBefore?: Date
  dueIsNull?: boolean
  gateId?: string
  includeUnscheduledForDay?: boolean
  labelId?: string
  limit?: number
  noGate?: boolean
  /** Instant used to derive the read-only lifecycle of elapsed open tasks. */
  now?: Date
  priority?: QuestPriority
  search?: string
  sort?: QuestListSort
  /** Narrows the active lifecycle: "open", "completed", or "all" (both). */
  status?: QuestStatus | "all"
}>

const questSelection = {
  completedAt: tasks.completedAt,
  deletedAt: tasks.deletedAt,
  description: tasks.description,
  dueAt: tasks.dueAt,
  id: tasks.id,
  parentTaskId: tasks.parentTaskId,
  position: tasks.position,
  priority: tasks.priority,
  projectId: tasks.projectId,
  recurrenceOccurrenceAt: tasks.recurrenceOccurrenceAt,
  recurrenceRule: tasks.recurrenceRule,
  recurrenceSequence: tasks.recurrenceSequence,
  recurrenceSeriesId: tasks.recurrenceSeriesId,
  recurrenceTimezone: tasks.recurrenceTimezone,
  offlineMutationId: tasks.offlineMutationId,
  xpReward: tasks.xpReward,
  startAt: tasks.startAt,
  status: tasks.status,
  title: tasks.title,
  version: tasks.version,
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

function effectiveQuestStatus(now: Date) {
  return sql<QuestStatus>`case
    when ${tasks.status} = 'open'
      and ${tasks.dueAt} is not null
      and ${tasks.dueAt} < ${sql.param(now, tasks.dueAt)}
    then 'failed'
    else ${tasks.status}
  end`
}

/**
 * The same lifecycle semantics as `effectiveQuestStatus`, expressed against
 * bare columns so the planner can use an index.
 *
 * Postgres matches indexes on column references, not on the result of a CASE
 * expression, so `eq(effectiveQuestStatus(now), status)` forced a sequential
 * scan of every task in the workspace on each list query. Filtering on
 * `tasks.status` lets `tasks_workspace_status_idx` apply.
 *
 * Kept in sync with `effectiveQuestStatus`, which still drives projections:
 *   open      -> status = 'open' AND (dueAt IS NULL OR dueAt >= now)
 *   failed    -> status = 'failed' OR (status = 'open' AND dueAt < now)
 *   completed -> status = 'completed'
 */
function effectiveStatusPredicate(
  status: QuestStatus,
  now: Date,
): SQL | undefined {
  if (status === "completed") {
    return eq(tasks.status, "completed")
  }

  if (status === "failed") {
    return or(
      eq(tasks.status, "failed"),
      and(
        eq(tasks.status, "open"),
        isNotNull(tasks.dueAt),
        lt(tasks.dueAt, now),
      ),
    )
  }

  return and(
    eq(tasks.status, "open"),
    or(isNull(tasks.dueAt), gte(tasks.dueAt, now)),
  )
}

function lifecyclePredicate(
  kind: QuestListKind,
  options: QuestListOptions,
  now: Date,
) {
  if (kind === "deleted") {
    return and(isNotNull(tasks.deletedAt), isNull(tasks.purgedAt))
  }

  if (kind === "cleared") {
    return and(isNull(tasks.deletedAt), eq(tasks.status, "completed"))
  }

  if (kind === "today") {
    return undefined
  }

  const statusPredicate =
    options.status === "all"
      ? undefined
      : effectiveStatusPredicate(options.status ?? "open", now)

  return and(isNull(tasks.deletedAt), statusPredicate)
}

function escapeSearchTerm(search: string) {
  return search.replace(/[\\%_]/gu, (character) => `\\${character}`)
}

function filterPredicates(
  database: DatabaseExecutor,
  access: AccessContext,
  options: QuestListOptions,
  now: Date,
): Array<SQL | undefined> {
  const predicates: Array<SQL | undefined> = []

  if (options.priority) {
    predicates.push(eq(tasks.priority, options.priority))
  }

  if (options.gateId) {
    predicates.push(eq(tasks.projectId, options.gateId))
  }

  if (options.noGate) {
    predicates.push(isNull(tasks.projectId))
  }

  if (options.labelId) {
    predicates.push(
      exists(
        database
          .select({ questId: questLabels.questId })
          .from(questLabels)
          .where(
            and(
              eq(questLabels.questId, tasks.id),
              eq(questLabels.labelId, options.labelId),
              eq(questLabels.workspaceId, access.workspaceId),
            ),
          ),
      ),
    )
  }

  if (options.search) {
    const pattern = `%${escapeSearchTerm(options.search)}%`
    predicates.push(
      or(ilike(tasks.title, pattern), ilike(tasks.description, pattern)),
    )
  }

  if (options.dueBefore) {
    predicates.push(
      and(isNotNull(tasks.dueAt), lt(tasks.dueAt, options.dueBefore)),
    )
  }

  if (options.dueAfter) {
    predicates.push(
      and(isNotNull(tasks.dueAt), gte(tasks.dueAt, options.dueAfter)),
    )
  }

  if (options.dueIsNull) {
    predicates.push(isNull(tasks.dueAt))
  }

  if (options.deletedAfter) {
    predicates.push(
      and(
        isNotNull(tasks.deletedAt),
        gte(tasks.deletedAt, options.deletedAfter),
      ),
    )
  }

  if (options.dayStart && options.dayEnd) {
    const effectiveStatus = effectiveQuestStatus(now)
    const scheduledInWindow = or(
      and(
        isNotNull(tasks.startAt),
        lt(tasks.startAt, options.dayEnd),
        or(isNull(tasks.dueAt), gte(tasks.dueAt, options.dayStart)),
      ),
      and(
        isNull(tasks.startAt),
        isNotNull(tasks.dueAt),
        gte(tasks.dueAt, options.dayStart),
        lt(tasks.dueAt, options.dayEnd),
      ),
    )

    predicates.push(
      or(
        and(
          eq(effectiveStatus, "open"),
          isNull(tasks.deletedAt),
          or(
            scheduledInWindow,
            options.includeUnscheduledForDay
              ? and(isNull(tasks.startAt), isNull(tasks.dueAt))
              : undefined,
          ),
        ),
        and(
          eq(effectiveStatus, "completed"),
          isNull(tasks.deletedAt),
          isNotNull(tasks.completedAt),
          gte(tasks.completedAt, options.dayStart),
          lt(tasks.completedAt, options.dayEnd),
        ),
        and(
          eq(effectiveStatus, "failed"),
          isNull(tasks.deletedAt),
          isNotNull(tasks.dueAt),
          gte(tasks.dueAt, options.dayStart),
          lt(tasks.dueAt, options.dayEnd),
        ),
      ),
    )
  }

  return predicates
}

function sortClauses(sort: QuestListSort | undefined): SQL[] {
  switch (sort) {
    case "due-soonest":
      return [
        sql`${tasks.dueAt} asc nulls last`,
        asc(tasks.position),
        desc(tasks.updatedAt),
      ]
    case "due-latest":
      return [
        sql`${tasks.dueAt} desc nulls last`,
        asc(tasks.position),
        desc(tasks.updatedAt),
      ]
    case "priority":
      return [
        sql`case ${tasks.priority} when 'critical' then 0 when 'high' then 1 when 'medium' then 2 else 3 end asc`,
        sql`${tasks.dueAt} asc nulls last`,
        desc(tasks.updatedAt),
      ]
    case "recently-updated":
      return [desc(tasks.updatedAt), asc(tasks.position)]
    default:
      return [asc(tasks.position), asc(tasks.dueAt), desc(tasks.updatedAt)]
  }
}

function questIdentityPredicate(
  database: DatabaseExecutor,
  access: AccessContext,
  questId: string,
) {
  return and(
    eq(tasks.id, questId),
    eq(tasks.workspaceId, access.workspaceId),
    activeAccessPredicate(database, access),
  )
}

export async function createQuestRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  input: CreateQuestRecord,
): Promise<QuestRecord | null> {
  const [created] = await database
    .insert(tasks)
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
          projectId: sql<
            string | null
          >`${sql.param(input.projectId, gates.id)}`.as("project_id"),
          parentTaskId: sql<
            string | null
          >`${sql.param(input.parentTaskId, tasks.id)}`.as("parent_task_id"),
          title: sql<string>`${input.title}::varchar(160)`.as("title"),
          description: sql<string>`${input.description}::text`.as(
            "description",
          ),
          status: sql<QuestStatus>`'open'::varchar(16)`.as("status"),
          priority: sql<QuestPriority>`${input.priority}::varchar(16)`.as(
            "priority",
          ),
          position:
            sql<number>`coalesce((select max("position") from "tasks" where "workspace_id" = ${access.workspaceId}::uuid), -1) + 1`.as(
              "position",
            ),
          startAt:
            sql<Date | null>`${sql.param(input.startAt, tasks.startAt)}`.as(
              "start_at",
            ),
          dueAt: sql<Date | null>`${sql.param(input.dueAt, tasks.dueAt)}`.as(
            "due_at",
          ),
          recurrenceRule: sql<
            string | null
          >`${sql.param(input.recurrenceRule, tasks.recurrenceRule)}`.as(
            "recurrence_rule",
          ),
          recurrenceTimezone: sql<
            string | null
          >`${sql.param(input.recurrenceTimezone, tasks.recurrenceTimezone)}`.as(
            "recurrence_timezone",
          ),
          recurrenceSeriesId: sql<
            string | null
          >`${sql.param(input.recurrenceSeriesId, tasks.recurrenceSeriesId)}`.as(
            "recurrence_series_id",
          ),
          recurrenceOccurrenceAt:
            sql<Date | null>`${sql.param(input.recurrenceOccurrenceAt, tasks.recurrenceOccurrenceAt)}`.as(
              "recurrence_occurrence_at",
            ),
          recurrenceSequence: sql<
            number | null
          >`${sql.param(input.recurrenceSequence, tasks.recurrenceSequence)}`.as(
            "recurrence_sequence",
          ),
          offlineMutationId: sql<
            string | null
          >`${sql.param(input.offlineMutationId ?? null, tasks.offlineMutationId)}`.as(
            "offline_mutation_id",
          ),
          xpReward: sql<number>`0::integer`.as("xp_reward"),
          completedAt: sql<Date | null>`null::timestamptz`.as("completed_at"),
          version: sql<number>`1::integer`.as("version"),
          createdAt: sql<Date>`now()`.as("created_at"),
          updatedAt: sql<Date>`now()`.as("updated_at"),
          deletedAt: sql<Date | null>`null::timestamptz`.as("deleted_at"),
          purgedAt: sql<Date | null>`null::timestamptz`.as("purged_at"),
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
    .returning(questSelection)

  return created ?? null
}

export async function listQuestRecords(
  database: DatabaseExecutor,
  access: AccessContext,
  kind: QuestListKind,
  options: QuestListOptions = {},
): Promise<readonly QuestListItem[]> {
  const now = options.now ?? new Date()
  const visibleStatus =
    kind === "active" || kind === "today"
      ? effectiveQuestStatus(now)
      : tasks.status
  const subquestCounts = database
    .select({
      parentId: tasks.parentTaskId,
      subquestCount: count().as("subquest_count"),
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceId, access.workspaceId),
        isNull(tasks.deletedAt),
        isNotNull(tasks.parentTaskId),
      ),
    )
    .groupBy(tasks.parentTaskId)
    .as("subquest_counts")

  return database
    .select({
      ...questSelection,
      gateName: gates.name,
      status: visibleStatus,
      subquestCount: sql<number>`coalesce(${subquestCounts.subquestCount}, 0)::integer`,
    })
    .from(tasks)
    .leftJoin(
      gates,
      and(eq(gates.id, tasks.projectId), isNull(gates.deletedAt)),
    )
    .leftJoin(subquestCounts, eq(subquestCounts.parentId, tasks.id))
    .where(
      and(
        eq(tasks.workspaceId, access.workspaceId),
        isNull(tasks.purgedAt),
        activeAccessPredicate(database, access),
        lifecyclePredicate(kind, options, now),
        ...filterPredicates(database, access, options, now),
      ),
    )
    .orderBy(...sortClauses(options.sort))
    .limit(options.limit ?? 200)
}

export function listQuestParentRecords(
  database: DatabaseExecutor,
  access: AccessContext,
  limit: number,
): Promise<readonly QuestParentRecord[]> {
  return database
    .select({
      id: tasks.id,
      parentTaskId: tasks.parentTaskId,
      title: tasks.title,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceId, access.workspaceId),
        isNull(tasks.deletedAt),
        activeAccessPredicate(database, access),
      ),
    )
    .orderBy(desc(tasks.updatedAt), asc(tasks.title))
    .limit(limit)
}

export function listQuestOrderRecordsForUpdate(
  database: DatabaseExecutor,
  access: AccessContext,
  limit: number,
): Promise<readonly QuestOrderRecord[]> {
  return database
    .select({ id: tasks.id, position: tasks.position, version: tasks.version })
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceId, access.workspaceId),
        eq(tasks.status, "open"),
        isNull(tasks.deletedAt),
        activeAccessPredicate(database, access),
      ),
    )
    .orderBy(asc(tasks.position), asc(tasks.dueAt), desc(tasks.updatedAt))
    .for("update", { of: tasks })
    .limit(limit)
}

export async function reorderQuestRecords(
  database: DatabaseExecutor,
  access: AccessContext,
  records: readonly (QuestOrderRecord & { nextPosition: number })[],
): Promise<number> {
  if (records.length === 0) {
    return 0
  }

  const values = sql.join(
    records.map(
      ({ id, nextPosition, version }) =>
        sql`(${id}::uuid, ${version}::integer, ${nextPosition}::integer)`,
    ),
    sql`, `,
  )
  const result = await database.execute(sql`
    update ${tasks} as task
    set
      position = requested.position,
      updated_at = now(),
      version = task.version + 1
    from (values ${values}) as requested(id, expected_version, position)
    where task.id = requested.id
      and task.workspace_id = ${access.workspaceId}::uuid
      and task.version = requested.expected_version
      and task.status = 'open'
      and task.deleted_at is null
    returning task.id
  `)

  return result.length
}

export async function findQuestRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  questId: string,
  includeDeleted = false,
): Promise<QuestRecord | null> {
  const [quest] = await database
    .select(questSelection)
    .from(tasks)
    .where(
      and(
        questIdentityPredicate(database, access, questId),
        isNull(tasks.purgedAt),
        includeDeleted ? undefined : isNull(tasks.deletedAt),
      ),
    )
    .limit(1)

  return quest ?? null
}

export async function findQuestByOfflineMutationId(
  database: DatabaseExecutor,
  access: AccessContext,
  offlineMutationId: string,
): Promise<QuestRecord | null> {
  const [quest] = await database
    .select(questSelection)
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceId, access.workspaceId),
        eq(tasks.offlineMutationId, offlineMutationId),
        isNull(tasks.purgedAt),
        activeAccessPredicate(database, access),
      ),
    )
    .limit(1)

  return quest ?? null
}

async function updateQuestRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  questId: string,
  expectedVersion: number,
  changes: Readonly<{
    completedAt?: Date | null
    deletedAt?: Date | null
    description?: string
    dueAt?: Date | null
    parentTaskId?: string | null
    priority?: QuestPriority
    projectId?: string | null
    recurrenceOccurrenceAt?: Date | null
    recurrenceRule?: string | null
    recurrenceSequence?: number | null
    recurrenceSeriesId?: string | null
    recurrenceTimezone?: string | null
    offlineMutationId?: string | null
    purgedAt?: Date | null
    xpReward?: number
    startAt?: Date | null
    status?: QuestStatus
    title?: string
  }>,
  lifecycle: "active" | "deleted",
  status?: QuestStatus,
): Promise<QuestRecord | null> {
  const predicates: Array<SQL | undefined> = [
    questIdentityPredicate(database, access, questId),
    eq(tasks.version, expectedVersion),
    lifecycle === "active"
      ? isNull(tasks.deletedAt)
      : isNotNull(tasks.deletedAt),
    isNull(tasks.purgedAt),
    status ? eq(tasks.status, status) : undefined,
  ]
  const [updated] = await database
    .update(tasks)
    .set({
      ...changes,
      updatedAt: new Date(),
      version: sql`${tasks.version} + 1`,
    })
    .where(and(...predicates))
    .returning(questSelection)

  return updated ?? null
}

export function editQuestRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  input: EditQuestRecord & { expectedVersion: number; questId: string },
): Promise<QuestRecord | null> {
  return updateQuestRecord(
    database,
    access,
    input.questId,
    input.expectedVersion,
    {
      description: input.description,
      dueAt: input.dueAt,
      parentTaskId: input.parentTaskId,
      priority: input.priority,
      projectId: input.projectId,
      recurrenceOccurrenceAt: input.recurrenceOccurrenceAt,
      recurrenceRule: input.recurrenceRule,
      recurrenceSequence: input.recurrenceSequence,
      recurrenceSeriesId: input.recurrenceSeriesId,
      recurrenceTimezone: input.recurrenceTimezone,
      startAt: input.startAt,
      title: input.title,
    },
    "active",
  )
}

export async function createNextRecurringQuestRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  current: QuestRecord,
  nextOccurrenceAt: Date,
): Promise<QuestRecord | null> {
  if (
    !current.recurrenceRule ||
    !current.recurrenceTimezone ||
    !current.recurrenceSeriesId ||
    current.recurrenceSequence === null ||
    !current.recurrenceOccurrenceAt
  ) {
    return null
  }

  const shift =
    nextOccurrenceAt.getTime() - current.recurrenceOccurrenceAt.getTime()
  const shifted = (value: Date | null) =>
    value ? new Date(value.getTime() + shift) : null
  const [created] = await database
    .insert(tasks)
    .values({
      createdByUserId: access.userId,
      description: current.description,
      dueAt: shifted(current.dueAt),
      parentTaskId: current.parentTaskId,
      position: sql`coalesce((select max("position") from "tasks" where "workspace_id" = ${access.workspaceId}::uuid), -1) + 1`,
      priority: current.priority,
      projectId: current.projectId,
      recurrenceOccurrenceAt: nextOccurrenceAt,
      recurrenceRule: current.recurrenceRule,
      recurrenceSequence: current.recurrenceSequence + 1,
      recurrenceSeriesId: current.recurrenceSeriesId,
      recurrenceTimezone: current.recurrenceTimezone,
      startAt: shifted(current.startAt),
      title: current.title,
      workspaceId: access.workspaceId,
    })
    .onConflictDoNothing()
    .returning(questSelection)

  if (created) {
    const assignments = await database
      .select({ labelId: questLabels.labelId })
      .from(questLabels)
      .where(
        and(
          eq(questLabels.questId, current.id),
          eq(questLabels.workspaceId, access.workspaceId),
        ),
      )

    if (assignments.length) {
      await database
        .insert(questLabels)
        .values(
          assignments.map(({ labelId }) => ({
            createdByUserId: access.userId,
            labelId,
            questId: created.id,
            workspaceId: access.workspaceId,
          })),
        )
        .onConflictDoNothing()
    }
  }

  return created ?? null
}

export function completeQuestRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  questId: string,
  expectedVersion: number,
  completedAt: Date,
  xpReward: number,
  offlineMutationId?: string,
): Promise<QuestRecord | null> {
  return updateQuestRecord(
    database,
    access,
    questId,
    expectedVersion,
    {
      completedAt,
      ...(offlineMutationId ? { offlineMutationId } : {}),
      status: "completed",
      xpReward,
    },
    "active",
    "open",
  )
}

/**
 * Marks an open task as missed. Guarded on "open" so a task completed in the
 * same moment as the sweep is never overwritten.
 */
export function failQuestRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  questId: string,
  expectedVersion: number,
): Promise<QuestRecord | null> {
  return updateQuestRecord(
    database,
    access,
    questId,
    expectedVersion,
    { status: "failed" },
    "active",
    "open",
  )
}

/**
 * Open, non-deleted tasks whose due time has already passed. Ordered oldest
 * first so same-day penalties escalate in the order the tasks were missed.
 */
export function listOverdueQuestRecords(
  database: DatabaseExecutor,
  access: AccessContext,
  now: Date,
  limit: number,
): Promise<readonly QuestRecord[]> {
  return database
    .select(questSelection)
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceId, access.workspaceId),
        eq(tasks.status, "open"),
        isNull(tasks.deletedAt),
        isNotNull(tasks.dueAt),
        lt(tasks.dueAt, now),
        activeAccessPredicate(database, access),
      ),
    )
    .orderBy(asc(tasks.dueAt), asc(tasks.position))
    .limit(limit)
}

/**
 * Distinct workspace/owner pairs that currently hold overdue open tasks. Used
 * by the scheduled sweep, which has no AccessContext of its own and must build
 * one per owner so tenancy rules still apply.
 */
export function listOverdueSweepCandidates(
  database: DatabaseExecutor,
  now: Date,
  limit: number,
): Promise<readonly Readonly<{ userId: string; workspaceId: string }>[]> {
  return database
    .selectDistinct({
      userId: tasks.createdByUserId,
      workspaceId: tasks.workspaceId,
    })
    .from(tasks)
    .innerJoin(
      workspaces,
      and(eq(workspaces.id, tasks.workspaceId), isNull(workspaces.deletedAt)),
    )
    .where(
      and(
        eq(tasks.status, "open"),
        isNull(tasks.deletedAt),
        isNotNull(tasks.dueAt),
        lt(tasks.dueAt, now),
      ),
    )
    .limit(limit)
}

export function reopenQuestRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  questId: string,
  expectedVersion: number,
): Promise<QuestRecord | null> {
  return updateQuestRecord(
    database,
    access,
    questId,
    expectedVersion,
    { completedAt: null, status: "open", xpReward: 0 },
    "active",
    "completed",
  )
}

export function softDeleteQuestRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  questId: string,
  expectedVersion: number,
  deletedAt: Date,
): Promise<QuestRecord | null> {
  return updateQuestRecord(
    database,
    access,
    questId,
    expectedVersion,
    { deletedAt },
    "active",
  )
}

export function restoreQuestRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  questId: string,
  expectedVersion: number,
): Promise<QuestRecord | null> {
  return updateQuestRecord(
    database,
    access,
    questId,
    expectedVersion,
    { deletedAt: null },
    "deleted",
  )
}

export function restoreQuestWithScheduleRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  input: Readonly<{
    dueAt: Date
    expectedVersion: number
    questId: string
    startAt: Date
  }>,
): Promise<QuestRecord | null> {
  return updateQuestRecord(
    database,
    access,
    input.questId,
    input.expectedVersion,
    {
      completedAt: null,
      deletedAt: null,
      dueAt: input.dueAt,
      recurrenceOccurrenceAt: null,
      recurrenceRule: null,
      recurrenceSequence: null,
      recurrenceSeriesId: null,
      recurrenceTimezone: null,
      startAt: input.startAt,
      status: "open",
      xpReward: 0,
    },
    "deleted",
  )
}

export function purgeQuestRecord(
  database: DatabaseExecutor,
  access: AccessContext,
  questId: string,
  expectedVersion: number,
  purgedAt: Date,
): Promise<QuestRecord | null> {
  return updateQuestRecord(
    database,
    access,
    questId,
    expectedVersion,
    { purgedAt },
    "deleted",
  )
}

/**
 * Walks the parent chain upward within the workspace, returning ancestor
 * Quest IDs from nearest parent upward. Bounded by the subquest depth
 * policy plus a small safety margin so malformed chains cannot loop.
 */
export async function getQuestAncestorIds(
  database: DatabaseExecutor,
  access: AccessContext,
  questId: string,
): Promise<readonly string[]> {
  const ancestors: string[] = []
  let currentId = questId

  for (let step = 0; step <= maxSubquestDepth + 2; step += 1) {
    const [current] = await database
      .select({ parentTaskId: tasks.parentTaskId })
      .from(tasks)
      .where(
        and(
          eq(tasks.id, currentId),
          eq(tasks.workspaceId, access.workspaceId),
          isNull(tasks.deletedAt),
          activeAccessPredicate(database, access),
        ),
      )
      .limit(1)

    if (!current?.parentTaskId || ancestors.includes(current.parentTaskId)) {
      break
    }

    ancestors.push(current.parentTaskId)
    currentId = current.parentTaskId
  }

  return ancestors
}

/**
 * Loads label badges for a batch of quests in one indexed query, grouped
 * by quest ID.
 */
export async function getQuestLabelBadges(
  database: DatabaseExecutor,
  access: AccessContext,
  questIds: readonly string[],
): Promise<ReadonlyMap<string, readonly QuestLabelBadge[]>> {
  const grouped = new Map<string, QuestLabelBadge[]>()

  if (questIds.length === 0) {
    return grouped
  }

  const rows = await database
    .select({
      colorToken: labels.colorToken,
      labelId: labels.id,
      name: labels.name,
      questId: questLabels.questId,
    })
    .from(questLabels)
    .innerJoin(labels, eq(labels.id, questLabels.labelId))
    .where(
      and(
        inArray(questLabels.questId, [...questIds]),
        eq(questLabels.workspaceId, access.workspaceId),
        isNull(labels.deletedAt),
        activeAccessPredicate(database, access),
      ),
    )
    .orderBy(asc(labels.name))

  for (const row of rows) {
    const existing = grouped.get(row.questId) ?? []
    existing.push({
      colorToken: row.colorToken,
      id: row.labelId,
      name: row.name,
    })
    grouped.set(row.questId, existing)
  }

  return grouped
}
