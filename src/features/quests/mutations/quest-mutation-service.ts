import "server-only"

import { randomUUID } from "node:crypto"

import { sql } from "drizzle-orm"

import type { Database, DatabaseExecutor } from "@/db/client"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { findGateRecord } from "@/features/gates/repositories/gate-repository"
import { authorizeQuestAccess } from "@/features/quests/authorization/quest-authorization"
import { QuestServiceError } from "@/features/quests/domain/errors"
import {
  canNestUnder,
  maxSubquestDepth,
} from "@/features/quests/domain/subquest-depth"
import {
  completeQuestRecord,
  createNextRecurringQuestRecord,
  createQuestRecord,
  editQuestRecord,
  failQuestRecord,
  findQuestByOfflineMutationId,
  findQuestRecord,
  getQuestAncestorIds,
  listOverdueQuestRecords,
  listQuestOrderRecordsForUpdate,
  purgeQuestRecord,
  reopenQuestRecord,
  reorderQuestRecords,
  restoreQuestRecord,
  restoreQuestWithScheduleRecord,
  softDeleteQuestRecord,
} from "@/features/quests/repositories/quest-repository"
import { calculateNextOccurrence } from "@/features/reminders/domain/recurrence"
import { findUserSettingsRecord } from "@/features/reminders/repositories/user-settings-repository"
import { clonePendingRemindersForOccurrence } from "@/features/reminders/repositories/reminder-repository"
import {
  calculateFailurePenalty,
  calculateQuestXp,
  localDateForInstant,
} from "@/features/progression/domain/progression"
import {
  countFailurePenalties,
  findProgressionEventFeedback,
  recordQuestProgression,
  type ProgressionMutationFeedback,
} from "@/features/progression/repositories/progression-repository"
import type {
  CreateQuestCommand,
  EditQuestCommand,
  QuestReorderCommand,
  QuestTransitionCommand,
  RestoreQuestScheduleCommand,
} from "@/features/quests/validation/quest-validation"
import { lockWorkspaceForMutation } from "@/features/workspaces/infrastructure/workspace-access-repository"
import { taskQuotaAvailable } from "@/lib/resource-quotas"

export type QuestMutationSummary = Readonly<{
  id: string
  progression?: ProgressionMutationFeedback
  version: number
}>

export type QuestReorderSummary = Readonly<{
  quests: readonly QuestMutationSummary[]
}>

const reorderLimit = 200

async function recurrenceFields(
  database: DatabaseExecutor,
  access: AccessContext,
  command: Pick<CreateQuestCommand, "dueAt" | "recurrenceRule" | "startAt">,
  current?: Awaited<ReturnType<typeof findQuestRecord>>,
) {
  if (!command.recurrenceRule) {
    return {
      recurrenceOccurrenceAt: null,
      recurrenceRule: null,
      recurrenceSequence: null,
      recurrenceSeriesId: null,
      recurrenceTimezone: null,
    } as const
  }

  const settings = await findUserSettingsRecord(database, access)
  if (!settings) {
    throw new QuestServiceError(
      "FORBIDDEN",
      "Timezone settings are unavailable for this workspace.",
    )
  }

  return {
    recurrenceOccurrenceAt: command.dueAt ?? command.startAt,
    recurrenceRule: command.recurrenceRule,
    recurrenceSequence: current?.recurrenceSequence ?? 0,
    recurrenceSeriesId: current?.recurrenceSeriesId ?? randomUUID(),
    recurrenceTimezone: settings.timezone,
  } as const
}

async function mutationFailure(
  database: DatabaseExecutor,
  access: AccessContext,
  command: QuestTransitionCommand,
  includeDeleted = false,
): Promise<never> {
  const current = await findQuestRecord(
    database,
    access,
    command.questId,
    includeDeleted,
  )

  if (!current) {
    throw new QuestServiceError("NOT_FOUND", "Task not found.")
  }

  throw new QuestServiceError(
    "CONFLICT",
    current.version === command.expectedVersion
      ? "The task changed state before this request completed."
      : "The task was updated elsewhere. Refresh and try again.",
  )
}

function summary(
  record: {
    id: string
    version: number
  },
  progression?: ProgressionMutationFeedback,
): QuestMutationSummary {
  return {
    id: record.id,
    ...(progression ? { progression } : {}),
    version: record.version,
  }
}

/**
 * Validates Gate assignment and Subquest placement before persisting:
 * the Gate must be active in this workspace, the parent Quest must exist
 * in this workspace, nesting depth stays within the deliberate limit, and
 * edits can never create a parent cycle.
 */
async function validatePlacement(
  database: DatabaseExecutor,
  access: AccessContext,
  placement: Readonly<{
    parentTaskId: string | null
    projectId: string | null
    questId?: string
  }>,
): Promise<void> {
  if (placement.projectId) {
    const gate = await findGateRecord(database, access, placement.projectId)

    if (!gate || gate.archivedAt) {
      throw new QuestServiceError(
        "VALIDATION_ERROR",
        "Choose an active List or leave the task without a List.",
      )
    }
  }

  if (!placement.parentTaskId) {
    return
  }

  if (placement.questId && placement.parentTaskId === placement.questId) {
    throw new QuestServiceError(
      "VALIDATION_ERROR",
      "A task cannot be its own subtask.",
    )
  }

  const parent = await findQuestRecord(database, access, placement.parentTaskId)

  if (!parent) {
    throw new QuestServiceError("NOT_FOUND", "Parent task not found.")
  }

  const ancestors = await getQuestAncestorIds(
    database,
    access,
    placement.parentTaskId,
  )

  if (placement.questId && ancestors.includes(placement.questId)) {
    throw new QuestServiceError(
      "VALIDATION_ERROR",
      "Subtasks cannot be nested under their own descendants.",
    )
  }

  if (!canNestUnder(ancestors.length)) {
    throw new QuestServiceError(
      "VALIDATION_ERROR",
      `Subtasks can only be nested ${maxSubquestDepth} levels deep.`,
    )
  }
}

function withWorkspaceMutation<T>(
  database: Database,
  access: AccessContext,
  mutation: (transaction: DatabaseExecutor) => Promise<T>,
): Promise<T> {
  return database.transaction(async (transaction) => {
    // Stamp the verified context for row-level security policies before any
    // domain write; the settings are transaction-local and vanish on commit.
    await transaction.execute(sql`
      select set_config('app.user_id', ${access.userId}, true),
             set_config('app.workspace_id', ${access.workspaceId}, true)
    `)

    if (!(await lockWorkspaceForMutation(transaction, access))) {
      throw new QuestServiceError(
        "FORBIDDEN",
        "Workspace access is no longer active.",
      )
    }

    return mutation(transaction)
  })
}

export async function createQuest(
  database: Database,
  access: AccessContext,
  command: CreateQuestCommand,
  offlineMutationId?: string,
): Promise<QuestMutationSummary> {
  authorizeQuestAccess(access)
  return withWorkspaceMutation(database, access, async (transaction) => {
    if (offlineMutationId) {
      const existing = await findQuestByOfflineMutationId(
        transaction,
        access,
        offlineMutationId,
      )

      if (existing) return summary(existing)
    }

    if (!(await taskQuotaAvailable(transaction, access.workspaceId))) {
      throw new QuestServiceError(
        "VALIDATION_ERROR",
        "This workspace has reached its retained task quota.",
      )
    }

    await validatePlacement(transaction, access, {
      parentTaskId: command.parentTaskId,
      projectId: command.projectId,
    })
    const created = await createQuestRecord(transaction, access, {
      ...command,
      offlineMutationId: offlineMutationId ?? null,
      ...(await recurrenceFields(transaction, access, command)),
    })

    if (!created) {
      throw new QuestServiceError(
        "FORBIDDEN",
        "Workspace access is no longer active.",
      )
    }

    return summary(created)
  })
}

export async function editQuest(
  database: Database,
  access: AccessContext,
  command: EditQuestCommand,
): Promise<QuestMutationSummary> {
  authorizeQuestAccess(access)
  return withWorkspaceMutation(database, access, async (transaction) => {
    const current = await findQuestRecord(transaction, access, command.questId)

    if (!current) {
      throw new QuestServiceError("NOT_FOUND", "Task not found.")
    }

    await validatePlacement(transaction, access, {
      parentTaskId:
        command.parentTaskId === current.parentTaskId
          ? null
          : command.parentTaskId,
      projectId:
        command.projectId === current.projectId ? null : command.projectId,
      questId: command.questId,
    })
    const updated = await editQuestRecord(transaction, access, {
      ...command,
      ...(await recurrenceFields(transaction, access, command, current)),
    })

    return updated
      ? summary(updated)
      : mutationFailure(transaction, access, command)
  })
}

export async function completeQuest(
  database: Database,
  access: AccessContext,
  command: QuestTransitionCommand,
  completedAt: Date = new Date(),
  offlineMutationId?: string,
): Promise<QuestMutationSummary> {
  authorizeQuestAccess(access)
  return withWorkspaceMutation(database, access, async (transaction) => {
    const current = await findQuestRecord(transaction, access, command.questId)

    if (!current) {
      throw new QuestServiceError("NOT_FOUND", "Task not found.")
    }

    if (
      offlineMutationId &&
      current.offlineMutationId === offlineMutationId &&
      current.status === "completed"
    ) {
      const progression = await findProgressionEventFeedback(
        transaction,
        access,
        `quest:${current.id}:completed:v${current.version}`,
      )
      return summary(current, progression ?? undefined)
    }

    const updated = await completeQuestRecord(
      transaction,
      access,
      command.questId,
      command.expectedVersion,
      completedAt,
      calculateQuestXp(current.priority),
      offlineMutationId,
    )

    if (!updated) {
      return mutationFailure(transaction, access, command)
    }

    if (
      current.recurrenceRule &&
      current.recurrenceTimezone &&
      current.recurrenceOccurrenceAt
    ) {
      const next = calculateNextOccurrence(
        current.recurrenceRule,
        current.recurrenceTimezone,
        current.recurrenceOccurrenceAt,
        completedAt,
      )

      if (next) {
        const successor = await createNextRecurringQuestRecord(
          transaction,
          access,
          current,
          next,
        )

        if (successor) {
          await clonePendingRemindersForOccurrence(transaction, access, {
            completedAt,
            currentOccurrenceAt: current.recurrenceOccurrenceAt,
            currentQuestId: current.id,
            nextOccurrenceAt: next,
            nextQuestId: successor.id,
          })
        }
      }
    }

    const settings = await findUserSettingsRecord(transaction, access)
    if (!settings) {
      throw new QuestServiceError(
        "FORBIDDEN",
        "Timezone settings are unavailable for this workspace.",
      )
    }
    const progression = await recordQuestProgression(transaction, access, {
      eventType: "quest_completed",
      idempotencyKey: `quest:${updated.id}:completed:v${updated.version}`,
      occurredAt: completedAt,
      quest: updated,
      reason: "quest_completion",
      timezone: settings.timezone,
      type: "award",
    })

    return summary(updated, progression)
  })
}

export type OverdueSweepSummary = Readonly<{
  failed: number
  xpLost: number
}>

/** Upper bound on tasks failed in a single sweep, keeping the work bounded. */
const overdueSweepLimit = 50

/**
 * Marks every open task whose due time has passed as missed, charging an
 * escalating XP penalty per miss within the same local day. Safe to call
 * repeatedly: each task only transitions once because the write is guarded on
 * "open", and the progression event carries a per-task idempotency key.
 *
 * Recurring series advance on a miss as well, so a skipped occurrence does not
 * stall the series.
 */
export async function failOverdueQuests(
  database: Database,
  access: AccessContext,
  now: Date = new Date(),
): Promise<OverdueSweepSummary> {
  authorizeQuestAccess(access)

  return withWorkspaceMutation(database, access, async (transaction) => {
    const overdue = await listOverdueQuestRecords(
      transaction,
      access,
      now,
      overdueSweepLimit,
    )

    if (overdue.length === 0) return { failed: 0, xpLost: 0 }

    const settings = await findUserSettingsRecord(transaction, access)
    if (!settings) {
      throw new QuestServiceError(
        "FORBIDDEN",
        "Timezone settings are unavailable for this workspace.",
      )
    }

    const localDate = localDateForInstant(now, settings.timezone)
    let failuresToday = await countFailurePenalties(
      transaction,
      access,
      localDate,
    )
    let failed = 0
    let xpLost = 0

    for (const quest of overdue) {
      const updated = await failQuestRecord(
        transaction,
        access,
        quest.id,
        quest.version,
      )

      // Completed or edited between the read and the write: leave it alone.
      if (!updated) continue

      failed += 1

      if (
        quest.recurrenceRule &&
        quest.recurrenceTimezone &&
        quest.recurrenceOccurrenceAt
      ) {
        const next = calculateNextOccurrence(
          quest.recurrenceRule,
          quest.recurrenceTimezone,
          quest.recurrenceOccurrenceAt,
          now,
        )

        if (next) {
          await createNextRecurringQuestRecord(transaction, access, quest, next)
        }
      }

      const progression = await recordQuestProgression(transaction, access, {
        eventType: "quest_failed",
        idempotencyKey: `quest:${updated.id}:failed:v${updated.version}`,
        occurredAt: now,
        penalty: calculateFailurePenalty(quest.priority, failuresToday),
        quest: updated,
        reason: "quest_failure_penalty",
        timezone: settings.timezone,
        type: "penalty",
      })

      if (progression.xpDelta < 0) {
        xpLost += Math.abs(progression.xpDelta)
        failuresToday += 1
      }
    }

    return { failed, xpLost }
  })
}

export async function reorderQuests(
  database: Database,
  access: AccessContext,
  command: QuestReorderCommand,
): Promise<QuestReorderSummary> {
  authorizeQuestAccess(access)

  return withWorkspaceMutation(database, access, async (transaction) => {
    const current = await listQuestOrderRecordsForUpdate(
      transaction,
      access,
      reorderLimit + 1,
    )

    if (current.length > reorderLimit) {
      throw new QuestServiceError(
        "VALIDATION_ERROR",
        "Manual ordering supports up to 200 active tasks.",
      )
    }

    const requestedById = new Map(
      command.quests.map((quest, position) => [
        quest.questId,
        { ...quest, position },
      ]),
    )

    if (
      current.length !== command.quests.length ||
      current.some((quest) => !requestedById.has(quest.id))
    ) {
      throw new QuestServiceError(
        "CONFLICT",
        "The active task list changed. Refresh before reordering.",
      )
    }

    for (const quest of current) {
      if (requestedById.get(quest.id)?.expectedVersion !== quest.version) {
        throw new QuestServiceError(
          "CONFLICT",
          "A task was updated elsewhere. The previous order was restored.",
        )
      }
    }

    const changed = current.flatMap((quest) => {
      const requested = requestedById.get(quest.id)

      return requested && requested.position !== quest.position
        ? [{ ...quest, nextPosition: requested.position }]
        : []
    })
    const updatedCount = await reorderQuestRecords(transaction, access, changed)

    if (updatedCount !== changed.length) {
      throw new QuestServiceError(
        "CONFLICT",
        "The task order changed before it could be saved.",
      )
    }

    const currentById = new Map(current.map((quest) => [quest.id, quest]))
    const changedIds = new Set(changed.map(({ id }) => id))

    return {
      quests: command.quests.map(({ questId }) => {
        const record = currentById.get(questId)

        if (!record) {
          throw new QuestServiceError(
            "CONFLICT",
            "The active task list changed. Refresh before reordering.",
          )
        }

        return {
          id: questId,
          version: record.version + (changedIds.has(questId) ? 1 : 0),
        }
      }),
    }
  })
}

export async function reopenQuest(
  database: Database,
  access: AccessContext,
  command: QuestTransitionCommand,
  reopenedAt: Date = new Date(),
): Promise<QuestMutationSummary> {
  authorizeQuestAccess(access)
  return withWorkspaceMutation(database, access, async (transaction) => {
    const current = await findQuestRecord(transaction, access, command.questId)
    if (!current) {
      throw new QuestServiceError("NOT_FOUND", "Task not found.")
    }
    const updated = await reopenQuestRecord(
      transaction,
      access,
      command.questId,
      command.expectedVersion,
    )

    if (!updated) return mutationFailure(transaction, access, command)

    const settings = await findUserSettingsRecord(transaction, access)
    if (!settings) {
      throw new QuestServiceError(
        "FORBIDDEN",
        "Timezone settings are unavailable for this workspace.",
      )
    }
    const progression = await recordQuestProgression(transaction, access, {
      eventType: "quest_reopened",
      idempotencyKey: `quest:${updated.id}:reopened:v${updated.version}`,
      occurredAt: reopenedAt,
      quest: updated,
      reason: "quest_reopen_reversal",
      timezone: settings.timezone,
      type: "reverse",
    })

    return summary(updated, progression)
  })
}

export async function softDeleteQuest(
  database: Database,
  access: AccessContext,
  command: QuestTransitionCommand,
  deletedAt: Date = new Date(),
): Promise<QuestMutationSummary> {
  authorizeQuestAccess(access)
  return withWorkspaceMutation(database, access, async (transaction) => {
    const current = await findQuestRecord(transaction, access, command.questId)
    if (!current) {
      throw new QuestServiceError("NOT_FOUND", "Task not found.")
    }
    const updated = await softDeleteQuestRecord(
      transaction,
      access,
      command.questId,
      command.expectedVersion,
      deletedAt,
    )

    if (!updated) return mutationFailure(transaction, access, command)

    const settings = await findUserSettingsRecord(transaction, access)
    if (!settings) {
      throw new QuestServiceError(
        "FORBIDDEN",
        "Timezone settings are unavailable for this workspace.",
      )
    }
    const progression = await recordQuestProgression(transaction, access, {
      eventType: "quest_deleted",
      idempotencyKey: `quest:${updated.id}:deleted:v${updated.version}`,
      occurredAt: deletedAt,
      quest: updated,
      ...(current.status === "completed"
        ? { reason: "quest_delete_reversal" as const, type: "reverse" as const }
        : { type: "activity" as const }),
      timezone: settings.timezone,
    })

    return summary(updated, progression)
  })
}

export async function restoreQuest(
  database: Database,
  access: AccessContext,
  command: QuestTransitionCommand,
  restoredAt: Date = new Date(),
): Promise<QuestMutationSummary> {
  authorizeQuestAccess(access)
  return withWorkspaceMutation(database, access, async (transaction) => {
    const current = await findQuestRecord(
      transaction,
      access,
      command.questId,
      true,
    )
    if (!current) {
      throw new QuestServiceError("NOT_FOUND", "Task not found.")
    }
    const settings = await findUserSettingsRecord(transaction, access)
    if (!settings) {
      throw new QuestServiceError(
        "FORBIDDEN",
        "Timezone settings are unavailable for this workspace.",
      )
    }
    if (
      !current.deletedAt ||
      localDateForInstant(current.deletedAt, settings.timezone) !==
        localDateForInstant(restoredAt, settings.timezone)
    ) {
      throw new QuestServiceError(
        "CONFLICT",
        "This task's recovery window ended with the day. Its activity remains in history.",
      )
    }
    const updated = await restoreQuestRecord(
      transaction,
      access,
      command.questId,
      command.expectedVersion,
    )

    if (!updated) {
      return mutationFailure(transaction, access, command, true)
    }

    const restoreXp = current.status === "completed" && current.xpReward > 0
    const progression = await recordQuestProgression(transaction, access, {
      eventType: "quest_restored",
      idempotencyKey: `quest:${updated.id}:restored:v${updated.version}`,
      occurredAt: restoredAt,
      quest: updated,
      ...(restoreXp
        ? { reason: "quest_restore" as const, type: "award" as const }
        : { type: "activity" as const }),
      timezone: settings.timezone,
    })

    return summary(updated, progression)
  })
}

export async function permanentlyDeleteQuest(
  database: Database,
  access: AccessContext,
  command: QuestTransitionCommand,
  purgedAt: Date = new Date(),
): Promise<QuestMutationSummary> {
  authorizeQuestAccess(access)
  return withWorkspaceMutation(database, access, async (transaction) => {
    const current = await findQuestRecord(
      transaction,
      access,
      command.questId,
      true,
    )
    if (!current?.deletedAt) {
      throw new QuestServiceError(
        "NOT_FOUND",
        "Only tasks currently in Trash can be permanently deleted.",
      )
    }

    const purged = await purgeQuestRecord(
      transaction,
      access,
      command.questId,
      command.expectedVersion,
      purgedAt,
    )
    if (!purged) {
      return mutationFailure(transaction, access, command, true)
    }

    return summary(purged)
  })
}

export async function restoreQuestWithSchedule(
  database: Database,
  access: AccessContext,
  command: RestoreQuestScheduleCommand,
  restoredAt: Date = new Date(),
): Promise<QuestMutationSummary> {
  authorizeQuestAccess(access)
  return withWorkspaceMutation(database, access, async (transaction) => {
    const current = await findQuestRecord(
      transaction,
      access,
      command.questId,
      true,
    )
    if (!current) {
      throw new QuestServiceError("NOT_FOUND", "Task not found.")
    }

    const settings = await findUserSettingsRecord(transaction, access)
    if (!settings) {
      throw new QuestServiceError(
        "FORBIDDEN",
        "Timezone settings are unavailable for this workspace.",
      )
    }
    if (
      !current.deletedAt ||
      localDateForInstant(current.deletedAt, settings.timezone) !==
        localDateForInstant(restoredAt, settings.timezone)
    ) {
      throw new QuestServiceError(
        "CONFLICT",
        "This task's recovery window ended with the day and it can no longer be restored.",
      )
    }

    const updated = await restoreQuestWithScheduleRecord(
      transaction,
      access,
      command,
    )
    if (!updated) {
      return mutationFailure(transaction, access, command, true)
    }

    const progression = await recordQuestProgression(transaction, access, {
      eventType: "quest_restored",
      idempotencyKey: `quest:${updated.id}:restored:v${updated.version}`,
      occurredAt: restoredAt,
      quest: updated,
      type: "activity",
      timezone: settings.timezone,
    })

    return summary(updated, progression)
  })
}
