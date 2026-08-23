import "server-only"

import type { Database, DatabaseExecutor } from "@/db/client"
import { isUniqueViolation } from "@/db/errors"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { authorizeGateAccess } from "@/features/gates/authorization/gate-authorization"
import { GateServiceError } from "@/features/gates/domain/errors"
import {
  archiveGateRecord,
  countGateQuests,
  createGateRecord,
  editGateRecord,
  findGateRecord,
  restoreGateRecord,
  softDeleteGateRecord,
} from "@/features/gates/repositories/gate-repository"
import type {
  CreateGateCommand,
  EditGateCommand,
  GateTransitionCommand,
} from "@/features/gates/validation/gate-validation"
import { lockWorkspaceForMutation } from "@/features/workspaces/infrastructure/workspace-access-repository"

export type GateMutationSummary = Readonly<{
  id: string
  version: number
}>

async function mutationFailure(
  database: DatabaseExecutor,
  access: AccessContext,
  command: GateTransitionCommand,
): Promise<never> {
  const current = await findGateRecord(database, access, command.gateId)

  if (!current) {
    throw new GateServiceError("NOT_FOUND", "List not found.")
  }

  throw new GateServiceError(
    "CONFLICT",
    current.version === command.expectedVersion
      ? "The List changed state before this request completed."
      : "The List was updated elsewhere. Refresh and try again.",
  )
}

function summary(record: { id: string; version: number }): GateMutationSummary {
  return { id: record.id, version: record.version }
}

function withWorkspaceMutation<T>(
  database: Database,
  access: AccessContext,
  mutation: (transaction: DatabaseExecutor) => Promise<T>,
): Promise<T> {
  return database.transaction(async (transaction) => {
    if (!(await lockWorkspaceForMutation(transaction, access))) {
      throw new GateServiceError(
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
    if (isUniqueViolation(error, "gates_workspace_name_unique")) {
      throw new GateServiceError(
        "VALIDATION_ERROR",
        "A List with this name already exists in the workspace.",
      )
    }

    throw error
  }
}

export async function createGate(
  database: Database,
  access: AccessContext,
  command: CreateGateCommand,
): Promise<GateMutationSummary> {
  authorizeGateAccess(access)
  return mapNameConflict(() =>
    withWorkspaceMutation(database, access, async (transaction) => {
      const created = await createGateRecord(transaction, access, command)

      if (!created) {
        throw new GateServiceError(
          "FORBIDDEN",
          "Workspace access is no longer active.",
        )
      }

      return summary(created)
    }),
  )
}

export async function editGate(
  database: Database,
  access: AccessContext,
  command: EditGateCommand,
): Promise<GateMutationSummary> {
  authorizeGateAccess(access)
  return mapNameConflict(() =>
    withWorkspaceMutation(database, access, async (transaction) => {
      const updated = await editGateRecord(transaction, access, command)

      return updated
        ? summary(updated)
        : mutationFailure(transaction, access, command)
    }),
  )
}

export async function archiveGate(
  database: Database,
  access: AccessContext,
  command: GateTransitionCommand,
  archivedAt: Date = new Date(),
): Promise<GateMutationSummary> {
  authorizeGateAccess(access)
  return withWorkspaceMutation(database, access, async (transaction) => {
    const updated = await archiveGateRecord(
      transaction,
      access,
      command.gateId,
      command.expectedVersion,
      archivedAt,
    )

    return updated
      ? summary(updated)
      : mutationFailure(transaction, access, command)
  })
}

export async function restoreGate(
  database: Database,
  access: AccessContext,
  command: GateTransitionCommand,
): Promise<GateMutationSummary> {
  authorizeGateAccess(access)
  return withWorkspaceMutation(database, access, async (transaction) => {
    const updated = await restoreGateRecord(
      transaction,
      access,
      command.gateId,
      command.expectedVersion,
    )

    return updated
      ? summary(updated)
      : mutationFailure(transaction, access, command)
  })
}

export async function softDeleteGate(
  database: Database,
  access: AccessContext,
  command: GateTransitionCommand,
  deletedAt: Date = new Date(),
): Promise<GateMutationSummary> {
  authorizeGateAccess(access)
  return withWorkspaceMutation(database, access, async (transaction) => {
    const assignedQuests = await countGateQuests(
      transaction,
      access,
      command.gateId,
    )

    if (assignedQuests > 0) {
      throw new GateServiceError(
        "VALIDATION_ERROR",
        "Move every task out of this List before deleting it, including tasks in recovery.",
      )
    }

    const updated = await softDeleteGateRecord(
      transaction,
      access,
      command.gateId,
      command.expectedVersion,
      deletedAt,
    )

    return updated
      ? summary(updated)
      : mutationFailure(transaction, access, command)
  })
}
