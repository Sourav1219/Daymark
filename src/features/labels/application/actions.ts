"use server"

import { getDatabase } from "@/db/client"
import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { LabelServiceError } from "@/features/labels/domain/errors"
import {
  assignQuestLabels,
  createLabel,
  editLabel,
  softDeleteLabel,
  type LabelMutationSummary,
} from "@/features/labels/mutations/label-mutation-service"
import {
  createLabelSchema,
  editLabelSchema,
  labelTransitionSchema,
  setQuestLabelsSchema,
} from "@/features/labels/validation/label-validation"
import {
  runActionMutation,
  validationFailure,
} from "@/lib/actions/action-helpers"
import type { ActionResult } from "@/lib/actions/action-result"

export type LabelActionState = ActionResult<LabelMutationSummary> | null
export type LabelTransitionInput = Readonly<{
  expectedVersion: number
  labelId: string
}>

const labelPaths = ["/labels", "/quests", "/today", "/cleared"] as const

function runLabelMutation<T>(userId: string, mutate: () => Promise<T>) {
  return runActionMutation({
    isExpectedError: (error): error is LabelServiceError =>
      error instanceof LabelServiceError,
    mutate,
    paths: labelPaths,
    rateLimit: { policy: "default", userId },
    system: "Label",
  })
}

export async function createLabelAction(
  _previousState: LabelActionState,
  formData: FormData,
): Promise<LabelActionState> {
  const access = await requireWorkspaceAccess()
  const parsed = createLabelSchema.safeParse({
    colorToken: formData.get("colorToken"),
    name: formData.get("name"),
  })

  if (!parsed.success) {
    return validationFailure(
      "Review the highlighted Label fields and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runLabelMutation(access.userId, () =>
    createLabel(getDatabase(), access, parsed.data),
  )
}

export async function editLabelAction(
  _previousState: LabelActionState,
  formData: FormData,
): Promise<LabelActionState> {
  const access = await requireWorkspaceAccess()
  const parsed = editLabelSchema.safeParse({
    colorToken: formData.get("colorToken"),
    expectedVersion: formData.get("expectedVersion"),
    labelId: formData.get("labelId"),
    name: formData.get("name"),
  })

  if (!parsed.success) {
    return validationFailure(
      "Review the highlighted Label fields and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runLabelMutation(access.userId, () =>
    editLabel(getDatabase(), access, parsed.data),
  )
}

export async function deleteLabelAction(
  input: LabelTransitionInput,
): Promise<ActionResult<LabelMutationSummary>> {
  const access = await requireWorkspaceAccess()
  const parsed = labelTransitionSchema.safeParse(input)

  if (!parsed.success) {
    return validationFailure(
      "Review the highlighted Label fields and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runLabelMutation(access.userId, () =>
    softDeleteLabel(getDatabase(), access, parsed.data),
  )
}

export async function setQuestLabelsAction(
  formData: FormData,
): Promise<ActionResult<{ assigned: number }>> {
  const access = await requireWorkspaceAccess()
  const parsed = setQuestLabelsSchema.safeParse({
    expectedVersion: formData.get("expectedVersion"),
    labelIds: formData.getAll("labelIds"),
    questId: formData.get("questId"),
  })

  if (!parsed.success) {
    return validationFailure(
      "Review the highlighted Label fields and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runLabelMutation(access.userId, async () => {
    await assignQuestLabels(getDatabase(), access, parsed.data)

    return { assigned: parsed.data.labelIds.length }
  })
}
