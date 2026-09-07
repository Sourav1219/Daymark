"use server"

import { getDatabase } from "@/db/client"
import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { LabelServiceError } from "@/features/labels/domain/errors"
import { assignQuestLabels } from "@/features/labels/mutations/label-mutation-service"
import { setQuestLabelsSchema } from "@/features/labels/validation/label-validation"
import {
  runActionMutation,
  validationFailure,
} from "@/lib/actions/action-helpers"
import type { ActionResult } from "@/lib/actions/action-result"

const labelPaths = ["/quests", "/today", "/cleared"] as const

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
