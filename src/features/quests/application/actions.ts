"use server"

import { getDatabase } from "@/db/client"
import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { QuestServiceError } from "@/features/quests/domain/errors"
import {
  completeQuest,
  createQuest,
  editQuest,
  permanentlyDeleteQuest,
  reopenQuest,
  reorderQuests,
  restoreQuest,
  restoreQuestWithSchedule,
  softDeleteQuest,
  type QuestMutationSummary,
  type QuestReorderSummary,
} from "@/features/quests/mutations/quest-mutation-service"
import {
  parseCreateQuestForm,
  parseEditQuestForm,
  parseRestoreQuestSchedule,
  questTransitionSchema,
  questReorderSchema,
} from "@/features/quests/validation/quest-validation"
import { getUserSettings } from "@/features/reminders/queries/user-settings-query-service"
import {
  runActionMutation,
  validationFailure,
} from "@/lib/actions/action-helpers"
import type { ActionResult } from "@/lib/actions/action-result"

export type QuestActionState = ActionResult<QuestMutationSummary> | null
export type QuestTransitionInput = Readonly<{
  expectedVersion: number
  questId: string
}>
export type QuestReorderInput = Readonly<{
  quests: readonly QuestTransitionInput[]
}>
export type RestoreQuestScheduleInput = Readonly<{
  dueAt: string
  expectedVersion: number
  questId: string
  startAt: string
}>

const questPaths = [
  "/quests",
  "/today",
  "/cleared",
  "/gates",
  "/progress",
] as const

function runQuestMutation<T>(userId: string, mutate: () => Promise<T>) {
  return runActionMutation({
    isExpectedError: (error): error is QuestServiceError =>
      error instanceof QuestServiceError,
    mutate,
    paths: questPaths,
    rateLimit: { policy: "default", userId },
    system: "Task",
  })
}

export async function createQuestAction(
  _previousState: QuestActionState,
  formData: FormData,
): Promise<QuestActionState> {
  const access = await requireWorkspaceAccess()
  const settings = await getUserSettings(access)
  const parsed = parseCreateQuestForm(
    {
      description: formData.get("description"),
      dueAt: formData.get("dueAt"),
      parentTaskId: formData.get("parentTaskId"),
      priority: formData.get("priority"),
      projectId: formData.get("projectId"),
      recurrenceRule: formData.get("recurrenceRule"),
      startAt: formData.get("startAt"),
      title: formData.get("title"),
    },
    settings.timezone,
  )

  if (!parsed.success) {
    return validationFailure(
      "Review the highlighted task fields and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runQuestMutation(access.userId, () =>
    createQuest(getDatabase(), access, parsed.data),
  )
}

export async function editQuestAction(
  _previousState: QuestActionState,
  formData: FormData,
): Promise<QuestActionState> {
  const access = await requireWorkspaceAccess()
  const settings = await getUserSettings(access)
  const parsed = parseEditQuestForm(
    {
      description: formData.get("description"),
      dueAt: formData.get("dueAt"),
      expectedVersion: formData.get("expectedVersion"),
      parentTaskId: formData.get("parentTaskId"),
      priority: formData.get("priority"),
      projectId: formData.get("projectId"),
      questId: formData.get("questId"),
      recurrenceRule: formData.get("recurrenceRule"),
      startAt: formData.get("startAt"),
      title: formData.get("title"),
    },
    settings.timezone,
  )

  if (!parsed.success) {
    return validationFailure(
      "Review the highlighted task fields and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runQuestMutation(access.userId, () =>
    editQuest(getDatabase(), access, parsed.data),
  )
}

export async function completeQuestAction(
  input: QuestTransitionInput,
): Promise<ActionResult<QuestMutationSummary>> {
  const access = await requireWorkspaceAccess()
  const parsed = questTransitionSchema.safeParse(input)

  if (!parsed.success) {
    return validationFailure(
      "Review the highlighted task fields and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runQuestMutation(access.userId, () =>
    completeQuest(getDatabase(), access, parsed.data),
  )
}

export async function reopenQuestAction(
  input: QuestTransitionInput,
): Promise<ActionResult<QuestMutationSummary>> {
  const access = await requireWorkspaceAccess()
  const parsed = questTransitionSchema.safeParse(input)

  if (!parsed.success) {
    return validationFailure(
      "Review the highlighted task fields and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runQuestMutation(access.userId, () =>
    reopenQuest(getDatabase(), access, parsed.data),
  )
}

export async function reorderQuestsAction(
  input: QuestReorderInput,
): Promise<ActionResult<QuestReorderSummary>> {
  const access = await requireWorkspaceAccess()
  const parsed = questReorderSchema.safeParse(input)

  if (!parsed.success) {
    return validationFailure(
      "Review the task order and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runQuestMutation(access.userId, () =>
    reorderQuests(getDatabase(), access, parsed.data),
  )
}

export async function softDeleteQuestAction(
  input: QuestTransitionInput,
): Promise<ActionResult<QuestMutationSummary>> {
  const access = await requireWorkspaceAccess()
  const parsed = questTransitionSchema.safeParse(input)

  if (!parsed.success) {
    return validationFailure(
      "Review the highlighted task fields and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runQuestMutation(access.userId, () =>
    softDeleteQuest(getDatabase(), access, parsed.data),
  )
}

export async function restoreQuestAction(
  input: QuestTransitionInput,
): Promise<ActionResult<QuestMutationSummary>> {
  const access = await requireWorkspaceAccess()
  const parsed = questTransitionSchema.safeParse(input)

  if (!parsed.success) {
    return validationFailure(
      "Review the highlighted task fields and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runQuestMutation(access.userId, () =>
    restoreQuest(getDatabase(), access, parsed.data),
  )
}

export async function permanentlyDeleteQuestAction(
  input: QuestTransitionInput,
): Promise<ActionResult<QuestMutationSummary>> {
  const access = await requireWorkspaceAccess()
  const parsed = questTransitionSchema.safeParse(input)

  if (!parsed.success) {
    return validationFailure(
      "Review the task deletion request and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runQuestMutation(access.userId, () =>
    permanentlyDeleteQuest(getDatabase(), access, parsed.data),
  )
}

export async function restoreQuestWithScheduleAction(
  input: RestoreQuestScheduleInput,
): Promise<ActionResult<QuestMutationSummary>> {
  const access = await requireWorkspaceAccess()
  const settings = await getUserSettings(access)
  const parsed = parseRestoreQuestSchedule(input, settings.timezone)

  if (!parsed.success) {
    return validationFailure(
      "Choose a new future timeline before restoring this task.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runQuestMutation(access.userId, () =>
    restoreQuestWithSchedule(getDatabase(), access, parsed.data),
  )
}
