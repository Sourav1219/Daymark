"use server"

import { getDatabase } from "@/db/client"
import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { GateServiceError } from "@/features/gates/domain/errors"
import {
  archiveGate,
  createGate,
  editGate,
  restoreGate,
  softDeleteGate,
  type GateMutationSummary,
} from "@/features/gates/mutations/gate-mutation-service"
import {
  createGateSchema,
  editGateSchema,
  gateTransitionSchema,
} from "@/features/gates/validation/gate-validation"
import {
  runActionMutation,
  validationFailure,
} from "@/lib/actions/action-helpers"
import type { ActionResult } from "@/lib/actions/action-result"

export type GateActionState = ActionResult<GateMutationSummary> | null
export type GateTransitionInput = Readonly<{
  expectedVersion: number
  gateId: string
}>

const gatePaths = ["/gates", "/quests"] as const

function runGateMutation(
  userId: string,
  mutate: () => Promise<GateMutationSummary>,
) {
  return runActionMutation({
    isExpectedError: (error): error is GateServiceError =>
      error instanceof GateServiceError,
    mutate,
    paths: gatePaths,
    rateLimit: { policy: "default", userId },
    system: "List",
  })
}

export async function createGateAction(
  _previousState: GateActionState,
  formData: FormData,
): Promise<GateActionState> {
  const access = await requireWorkspaceAccess()
  const parsed = createGateSchema.safeParse({
    accentToken: formData.get("accentToken"),
    description: formData.get("description"),
    name: formData.get("name"),
  })

  if (!parsed.success) {
    return validationFailure(
      "Review the highlighted list fields and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runGateMutation(access.userId, () =>
    createGate(getDatabase(), access, parsed.data),
  )
}

export async function editGateAction(
  _previousState: GateActionState,
  formData: FormData,
): Promise<GateActionState> {
  const access = await requireWorkspaceAccess()
  const parsed = editGateSchema.safeParse({
    accentToken: formData.get("accentToken"),
    description: formData.get("description"),
    expectedVersion: formData.get("expectedVersion"),
    gateId: formData.get("gateId"),
    name: formData.get("name"),
  })

  if (!parsed.success) {
    return validationFailure(
      "Review the highlighted list fields and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runGateMutation(access.userId, () =>
    editGate(getDatabase(), access, parsed.data),
  )
}

export async function archiveGateAction(
  input: GateTransitionInput,
): Promise<ActionResult<GateMutationSummary>> {
  const access = await requireWorkspaceAccess()
  const parsed = gateTransitionSchema.safeParse(input)

  if (!parsed.success) {
    return validationFailure(
      "Review the highlighted list fields and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runGateMutation(access.userId, () =>
    archiveGate(getDatabase(), access, parsed.data),
  )
}

export async function restoreGateAction(
  input: GateTransitionInput,
): Promise<ActionResult<GateMutationSummary>> {
  const access = await requireWorkspaceAccess()
  const parsed = gateTransitionSchema.safeParse(input)

  if (!parsed.success) {
    return validationFailure(
      "Review the highlighted list fields and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runGateMutation(access.userId, () =>
    restoreGate(getDatabase(), access, parsed.data),
  )
}

export async function softDeleteGateAction(
  input: GateTransitionInput,
): Promise<ActionResult<GateMutationSummary>> {
  const access = await requireWorkspaceAccess()
  const parsed = gateTransitionSchema.safeParse(input)

  if (!parsed.success) {
    return validationFailure(
      "Review the highlighted list fields and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runGateMutation(access.userId, () =>
    softDeleteGate(getDatabase(), access, parsed.data),
  )
}
