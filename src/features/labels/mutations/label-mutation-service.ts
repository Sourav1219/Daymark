import "server-only"

import type { Database, DatabaseExecutor } from "@/db/client"
import { isUniqueViolation } from "@/db/errors"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { authorizeLabelAccess } from "@/features/labels/authorization/label-authorization"
import { LabelServiceError } from "@/features/labels/domain/errors"
import {
  createLabelRecord,
  deleteLabelAssignments,
  editLabelRecord,
  findLabelRecord,
  getQuestLabelIds,
  setQuestLabels,
  softDeleteLabelRecord,
} from "@/features/labels/repositories/label-repository"
import type {
  CreateLabelCommand,
  EditLabelCommand,
  LabelTransitionCommand,
  SetQuestLabelsCommand,
} from "@/features/labels/validation/label-validation"
import { lockWorkspaceForMutation } from "@/features/workspaces/infrastructure/workspace-access-repository"

export type LabelMutationSummary = Readonly<{
  id: string
  version: number
}>

async function mutationFailure(
  database: DatabaseExecutor,
  access: AccessContext,
  command: LabelTransitionCommand,
): Promise<never> {
  const current = await findLabelRecord(database, access, command.labelId)

  if (!current) {
    throw new LabelServiceError("NOT_FOUND", "Label not found.")
  }

  throw new LabelServiceError(
    "CONFLICT",
    current.version === command.expectedVersion
      ? "The Label changed state before this request completed."
      : "The Label was updated elsewhere. Refresh and try again.",
  )
}

function summary(record: {
  id: string
  version: number
}): LabelMutationSummary {
  return { id: record.id, version: record.version }
}

function withWorkspaceMutation<T>(
  database: Database,
  access: AccessContext,
  mutation: (transaction: DatabaseExecutor) => Promise<T>,
): Promise<T> {
  return database.transaction(async (transaction) => {
    if (!(await lockWorkspaceForMutation(transaction, access))) {
      throw new LabelServiceError(
        "FORBIDDEN",
        "Workspace access is no longer active.",
      )
    }

    return mutation(transaction)
  })
}

async function mapNameConflict<T>(mutation: () => Promise<T>): Promise<T> {
  try {
    return await mutation()
  } catch (error) {
    if (isUniqueViolation(error, "labels_workspace_name_unique")) {
      throw new LabelServiceError(
        "VALIDATION_ERROR",
        "A Label with this name already exists in the workspace.",
      )
    }

    throw error
  }
}

export async function createLabel(
  database: Database,
  access: AccessContext,
  command: CreateLabelCommand,
): Promise<LabelMutationSummary> {
  authorizeLabelAccess(access)
  return mapNameConflict(() =>
    withWorkspaceMutation(database, access, async (transaction) => {
      const created = await createLabelRecord(transaction, access, command)

      if (!created) {
        throw new LabelServiceError(
          "FORBIDDEN",
          "Workspace access is no longer active.",
        )
      }

      return summary(created)
    }),
  )
}

export async function editLabel(
  database: Database,
  access: AccessContext,
  command: EditLabelCommand,
): Promise<LabelMutationSummary> {
  authorizeLabelAccess(access)
  return mapNameConflict(() =>
    withWorkspaceMutation(database, access, async (transaction) => {
      const updated = await editLabelRecord(transaction, access, command)

      return updated
        ? summary(updated)
        : mutationFailure(transaction, access, command)
    }),
  )
}

export async function softDeleteLabel(
  database: Database,
  access: AccessContext,
  command: LabelTransitionCommand,
  deletedAt: Date = new Date(),
): Promise<LabelMutationSummary> {
  authorizeLabelAccess(access)
  return withWorkspaceMutation(database, access, async (transaction) => {
    const updated = await softDeleteLabelRecord(
      transaction,
      access,
      command.labelId,
      command.expectedVersion,
      deletedAt,
    )

    if (!updated) {
      return mutationFailure(transaction, access, command)
    }

    await deleteLabelAssignments(transaction, access, command.labelId)

    return summary(updated)
  })
}

export async function assignQuestLabels(
  database: Database,
  access: AccessContext,
  command: SetQuestLabelsCommand,
): Promise<LabelMutationSummary> {
  authorizeLabelAccess(access)
  return withWorkspaceMutation(database, access, async (transaction) => {
    try {
      const version = await setQuestLabels(
        transaction,
        access,
        command.questId,
        command.expectedVersion,
        command.labelIds,
      )

      return { id: command.questId, version }
    } catch (error) {
      if (error instanceof Error && error.message === "QUEST_NOT_FOUND") {
        throw new LabelServiceError("NOT_FOUND", "Task not found.")
      }
      if (error instanceof Error && error.message === "LABEL_NOT_FOUND") {
        throw new LabelServiceError(
          "NOT_FOUND",
          "One or more labels were not found in this workspace.",
        )
      }
      if (error instanceof Error && error.message === "QUEST_CONFLICT") {
        throw new LabelServiceError(
          "CONFLICT",
          "The task was updated elsewhere. Refresh and try again.",
        )
      }
      throw error
    }
  })
}

export async function getQuestLabels(
  database: Database,
  access: AccessContext,
  questId: string,
): Promise<readonly string[]> {
  authorizeLabelAccess(access)

  return getQuestLabelIds(database, access, questId)
}
