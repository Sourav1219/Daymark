"use server"

import { getDatabase } from "@/db/client"
import {
  classifyQuest,
  rescheduleMissedQuest,
} from "@/features/quests/mutations/quest-mutation-service"
import {
  classifyQuestSchema,
  type ClassifyQuestCommand,
} from "@/features/quests/validation/classification-validation"
import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { QuestServiceError } from "@/features/quests/domain/errors"
import {
  completeQuest,
  createQuest,
  editQuest,
  editQuestSchedule,
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
  parseEditQuestSchedule,
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
export type EditQuestScheduleInput = Readonly<{
  dueAt?: string | null
  expectedVersion: number
  questId: string
  startAt?: string | null
}>

/**
 * Revalidation is scoped per mutation rather than invalidating every task
 * surface on every write. `revalidatePath` runs serially in `runActionMutation`,
 * so each unnecessary path is real added latency after the commit.
 *
 * - ordering only touches the boards that render manual order
 * - creating a task cannot affect Completed or progression
 * - only completing or reopening awards or reverses XP, so only those two
 *   touch /progress
 */
const boardPaths = ["/quests", "/today"] as const
const createPaths = ["/quests", "/today", "/gates"] as const
const lifecyclePaths = ["/quests", "/today", "/cleared", "/gates"] as const
const progressionPaths = [
  "/quests",
  "/today",
  "/cleared",
  "/gates",
  "/progress",
] as const

function runQuestMutation<T>(
  userId: string,
  paths: readonly string[],
  mutate: () => Promise<T>,
) {
  return runActionMutation({
    isExpectedError: (error): error is QuestServiceError =>
      error instanceof QuestServiceError,
    mutate,
    paths,
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
      customType: formData.get("customType") || undefined,
      description: formData.get("description"),
      dueAt: formData.get("dueAt"),
      parentTaskId: formData.get("parentTaskId"),
      priority: formData.get("priority"),
      projectId: formData.get("projectId"),
      recurrenceRule: formData.get("recurrenceRule"),
      startAt: formData.get("startAt"),
      taskType: formData.get("taskType") || undefined,
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

  return runQuestMutation(access.userId, createPaths, () =>
    createQuest(getDatabase(), access, parsed.data),
  )
}

export async function classifyQuestAction(input: ClassifyQuestCommand) {
  const access = await requireWorkspaceAccess()
  const parsed = classifyQuestSchema.safeParse(input)
  if (!parsed.success)
    return validationFailure("Choose a valid task type or priority.", {})
  return runQuestMutation(access.userId, [], () =>
    classifyQuest(getDatabase(), access, parsed.data),
  )
}

export async function rescheduleMissedQuestAction(
  input: RestoreQuestScheduleInput,
) {
  const access = await requireWorkspaceAccess()
  const settings = await getUserSettings(access)
  const parsed = parseRestoreQuestSchedule(input, settings.timezone)
  if (!parsed.success)
    return validationFailure("Choose a future start and deadline.", {})
  return runQuestMutation(access.userId, lifecyclePaths, () =>
    rescheduleMissedQuest(getDatabase(), access, parsed.data),
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
      customType: formData.get("customType") || undefined,
      description: formData.get("description"),
      dueAt: formData.get("dueAt"),
      expectedVersion: formData.get("expectedVersion"),
      parentTaskId: formData.get("parentTaskId"),
      priority: formData.get("priority"),
      projectId: formData.get("projectId"),
      questId: formData.get("questId"),
      recurrenceRule: formData.get("recurrenceRule"),
      startAt: formData.get("startAt"),
      taskType: formData.get("taskType") || undefined,
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

  return runQuestMutation(access.userId, lifecyclePaths, () =>
    editQuest(getDatabase(), access, parsed.data),
  )
}

export async function editQuestScheduleAction(
  input: EditQuestScheduleInput,
): Promise<ActionResult<QuestMutationSummary>> {
  const access = await requireWorkspaceAccess()
  const settings = await getUserSettings(access)
  const parsed = parseEditQuestSchedule(input, settings.timezone)

  if (!parsed.success) {
    return validationFailure(
      "Review the highlighted schedule fields and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runQuestMutation(access.userId, lifecyclePaths, () =>
    editQuestSchedule(getDatabase(), access, parsed.data),
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

  return runQuestMutation(access.userId, progressionPaths, () =>
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

  return runQuestMutation(access.userId, progressionPaths, () =>
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

  return runQuestMutation(access.userId, boardPaths, () =>
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

  return runQuestMutation(access.userId, lifecyclePaths, () =>
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

  return runQuestMutation(access.userId, lifecyclePaths, () =>
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

  return runQuestMutation(access.userId, lifecyclePaths, () =>
    permanentlyDeleteQuest(getDatabase(), access, parsed.data),
  )
}

export async function restoreQuestWithScheduleAction(
  input: RestoreQuestScheduleInput,
): Promise<ActionResult<QuestMutationSummary>> {
  const access = await requireWorkspaceAccess()
  const settings = await getUserSettings(access)
  const parsed = parseRestoreQuestSchedule(
    input,
    settings.timezone,
    new Date(),
    { sameDayOnly: true },
  )

  if (!parsed.success) {
    return validationFailure(
      "Choose future start and due times later today.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runQuestMutation(access.userId, lifecyclePaths, () =>
    restoreQuestWithSchedule(getDatabase(), access, parsed.data),
  )
}
