"use server"

import { getDatabase } from "@/db/client"
import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { TimerServiceError } from "@/features/timer/domain/errors"
import {
  createGroupStudySession,
  joinGroupStudySession,
  moderateGroupStudyParticipant,
  regenerateGroupStudyJoinCode,
  respondToJoinRequest,
  setGroupStudyJoinLocked,
  updateGroupStudySettings,
} from "@/features/timer/mutations/group-study-mutation-service"
import {
  editTimerSubject,
  pauseTimer,
  resumeTimer,
  startTimer,
  stopTimer,
  type TimerMutationSummary,
} from "@/features/timer/mutations/timer-mutation-service"
import { findGroupStudySessionWorkspaceId } from "@/features/timer/repositories/group-study-repository"
import {
  createGroupStudySchema,
  editTimerSubjectSchema,
  groupStudyRoomControlSchema,
  joinGroupStudySchema,
  moderateGroupStudyParticipantSchema,
  respondToJoinRequestSchema,
  setGroupStudyJoinLockedSchema,
  startTimerSchema,
  timerTransitionSchema,
  updateGroupStudySettingsSchema,
} from "@/features/timer/validation/timer-validation"
import type { ActionResult } from "@/lib/actions/action-result"
import {
  runActionMutation,
  validationFailure,
} from "@/lib/actions/action-helpers"
import type { RateLimitPolicy } from "@/lib/rate-limit/rate-limiter"

type TimerTransitionInput = Readonly<{
  expectedVersion: number
  sessionId: string
}>

function runTimerMutation(
  userId: string,
  policy: RateLimitPolicy,
  mutate: () => Promise<TimerMutationSummary>,
) {
  return runActionMutation({
    isExpectedError: (error): error is TimerServiceError =>
      error instanceof TimerServiceError,
    mutate,
    paths: ["/timer"],
    rateLimit: { policy, userId },
    system: "Timer",
  })
}

function runGroupStudyMutation<T>(
  userId: string,
  policy: RateLimitPolicy,
  mutate: () => Promise<T>,
) {
  return runActionMutation({
    isExpectedError: (error): error is TimerServiceError =>
      error instanceof TimerServiceError,
    mutate,
    paths: ["/timer"],
    rateLimit: { policy, userId },
    system: "Group Study",
  })
}

/**
 * Resolves the workspace that owns a group study room and then verifies the
 * caller is an active member of that workspace. This ensures every management
 * action is scoped to the room's actual workspace rather than the caller's
 * personal workspace, closing the authorization loophole.
 */
async function requireRoomWorkspaceAccess(roomId: string) {
  const database = getDatabase()
  const workspaceId = await findGroupStudySessionWorkspaceId(database, roomId)

  if (!workspaceId) {
    // Room not found or already closed — let the mutation service surface the
    // precise NOT_FOUND error after the access check.
    return requireWorkspaceAccess()
  }

  return requireWorkspaceAccess(workspaceId)
}

export async function createGroupStudyAction(input: {
  name: string
  participantLimit: number
  subject: string
}) {
  // Create always uses the caller's personal workspace — rooms are owned by
  // the host's personal workspace by design.
  const access = await requireWorkspaceAccess()
  const parsed = createGroupStudySchema.safeParse(input)
  if (!parsed.success) {
    return validationFailure(
      "Enter a subject before creating Group Study.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runGroupStudyMutation(access.userId, "groupStudyCreate", () =>
    createGroupStudySession(getDatabase(), access, parsed.data),
  )
}

export async function joinGroupStudyAction(input: { joinCode: string }) {
  // Join uses the caller's personal workspace — the joiner's timer is created
  // in their own workspace by design (cross-workspace joining is intentional).
  const access = await requireWorkspaceAccess()
  const parsed = joinGroupStudySchema.safeParse(input)
  if (!parsed.success) {
    return validationFailure(
      "Enter a valid Group Study code.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runGroupStudyMutation(access.userId, "groupStudyJoin", () =>
    joinGroupStudySession(getDatabase(), access, parsed.data.joinCode),
  )
}

export async function updateGroupStudySettingsAction(input: {
  name: string
  participantLimit: number
  roomId: string
  subject: string
}) {
  const parsed = updateGroupStudySettingsSchema.safeParse(input)
  if (!parsed.success) {
    return validationFailure(
      "Review the room settings and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }
  // Use the room's owning workspace, not the caller's personal workspace.
  const access = await requireRoomWorkspaceAccess(parsed.data.roomId)
  return runGroupStudyMutation(access.userId, "default", () =>
    updateGroupStudySettings(getDatabase(), access, parsed.data),
  )
}

export async function setGroupStudyJoinLockedAction(input: {
  joinLocked: boolean
  roomId: string
}) {
  const parsed = setGroupStudyJoinLockedSchema.safeParse(input)
  if (!parsed.success) {
    return validationFailure(
      "The room access setting is invalid.",
      parsed.error.flatten().fieldErrors,
    )
  }
  const access = await requireRoomWorkspaceAccess(parsed.data.roomId)
  return runGroupStudyMutation(access.userId, "default", () =>
    setGroupStudyJoinLocked(getDatabase(), access, parsed.data),
  )
}

export async function regenerateGroupStudyJoinCodeAction(input: {
  roomId: string
}) {
  const parsed = groupStudyRoomControlSchema.safeParse(input)
  if (!parsed.success) {
    return validationFailure(
      "The Group Study room is invalid.",
      parsed.error.flatten().fieldErrors,
    )
  }
  const access = await requireRoomWorkspaceAccess(parsed.data.roomId)
  return runGroupStudyMutation(access.userId, "default", () =>
    regenerateGroupStudyJoinCode(getDatabase(), access, parsed.data.roomId),
  )
}

export async function moderateGroupStudyParticipantAction(input: {
  action: "blocked" | "removed"
  participantId: string
  roomId: string
}) {
  const parsed = moderateGroupStudyParticipantSchema.safeParse(input)
  if (!parsed.success) {
    return validationFailure(
      "The participant control is invalid.",
      parsed.error.flatten().fieldErrors,
    )
  }
  const access = await requireRoomWorkspaceAccess(parsed.data.roomId)
  return runGroupStudyMutation(access.userId, "default", () =>
    moderateGroupStudyParticipant(getDatabase(), access, parsed.data),
  )
}

export async function respondToJoinRequestAction(input: {
  action: "approve" | "reject"
  requestId: string
  roomId: string
}) {
  const parsed = respondToJoinRequestSchema.safeParse(input)
  if (!parsed.success) {
    return validationFailure(
      "The join request control is invalid.",
      parsed.error.flatten().fieldErrors,
    )
  }
  const access = await requireRoomWorkspaceAccess(parsed.data.roomId)
  return runGroupStudyMutation(access.userId, "default", () =>
    respondToJoinRequest(getDatabase(), access, parsed.data),
  )
}

export async function startTimerAction(input: {
  subject: string
}): Promise<ActionResult<TimerMutationSummary>> {
  const access = await requireWorkspaceAccess()
  const parsed = startTimerSchema.safeParse(input)
  if (!parsed.success) {
    return validationFailure(
      "Enter a subject before starting the timer.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runTimerMutation(access.userId, "timerStart", () =>
    startTimer(getDatabase(), access, parsed.data.subject),
  )
}

async function transitionAction(
  input: TimerTransitionInput,
  transition: typeof pauseTimer | typeof resumeTimer | typeof stopTimer,
) {
  const access = await requireWorkspaceAccess()
  const parsed = timerTransitionSchema.safeParse(input)
  if (!parsed.success) {
    return validationFailure(
      "The timer state is invalid. Refresh and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runTimerMutation(access.userId, "default", () =>
    transition(getDatabase(), access, parsed.data),
  )
}

export async function pauseTimerAction(input: TimerTransitionInput) {
  return transitionAction(input, pauseTimer)
}

export async function resumeTimerAction(input: TimerTransitionInput) {
  return transitionAction(input, resumeTimer)
}

export async function stopTimerAction(input: TimerTransitionInput) {
  return transitionAction(input, stopTimer)
}

export async function editTimerSubjectAction(input: {
  expectedVersion: number
  sessionId: string
  subject: string
}) {
  const access = await requireWorkspaceAccess()
  const parsed = editTimerSubjectSchema.safeParse(input)
  if (!parsed.success) {
    return validationFailure(
      "Review the subject and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  return runTimerMutation(access.userId, "default", () =>
    editTimerSubject(getDatabase(), access, parsed.data),
  )
}
