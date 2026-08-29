import "server-only"

import { randomBytes } from "node:crypto"

import type { Database, DatabaseExecutor } from "@/db/client"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { TimerServiceError } from "@/features/timer/domain/errors"
import type { GroupStudyActivityAction } from "@/features/timer/domain/types"
import { calculateTimerElapsedMs } from "@/features/timer/domain/timer"
import {
  closeGroupStudySessionRecord,
  completeGroupStudyParticipantTimer,
  countActiveGroupStudyParticipants,
  createGroupStudyActivityRecord,
  createGroupStudyBlockRecord,
  createGroupStudyJoinRequestRecord,
  createGroupStudyParticipantRecord,
  createGroupStudySessionRecord,
  consumeApprovedJoinRequest,
  findActiveGroupStudyParticipant,
  findActiveGroupStudyParticipantForTimer,
  findGroupStudyBlock,
  findGroupStudySessionByCode,
  findGroupStudySessionRecord,
  findLatestJoinRequestForUser,
  groupStudyJoinCodeExists,
  lockActiveGroupStudyParticipantForModeration,
  lockGroupStudySessionRecord,
  markGroupStudyParticipantLeft,
  transferGroupStudyHostRecord,
  updateGroupStudySessionRecord,
  updateGroupStudyJoinRequestStatus,
} from "@/features/timer/repositories/group-study-repository"
import {
  createTimerSessionRecord,
  findActiveTimerSessionRecord,
} from "@/features/timer/repositories/timer-repository"
import { lockWorkspaceForMutation } from "@/features/workspaces/infrastructure/workspace-access-repository"
import { roomQuotaAvailable, timerQuotaAvailable } from "@/lib/resource-quotas"

const joinCodeAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
const joinCodeLength = 8

export type GroupStudyMutationSummary = Readonly<{
  status: "joined"
  joinCode: string
  roomId: string
  subject: string
  timerSessionId: string
  timerVersion: number
}>

export type GroupStudyControlSummary = Readonly<{
  joinCode: string
  joinLocked: boolean
  name: string
  participantLimit: number
  roomId: string
  subject: string
  version: number
}>

function generateJoinCode() {
  const bytes = randomBytes(joinCodeLength)
  return Array.from(
    bytes,
    (value) => joinCodeAlphabet[value % joinCodeAlphabet.length],
  ).join("")
}

async function createUniqueJoinCode(database: DatabaseExecutor) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateJoinCode()
    if (!(await groupStudyJoinCodeExists(database, code))) return code
  }

  throw new TimerServiceError(
    "INTERNAL_ERROR",
    "A Group Study code could not be generated. Try again.",
  )
}

async function requireAvailableTimer(
  database: DatabaseExecutor,
  access: AccessContext,
) {
  if (await findActiveTimerSessionRecord(database, access)) {
    throw new TimerServiceError(
      "CONFLICT",
      "Finish your current timer before starting or joining Group Study.",
    )
  }

  if (await findActiveGroupStudyParticipant(database, access)) {
    throw new TimerServiceError(
      "CONFLICT",
      "You are already participating in a Group Study session.",
    )
  }
}

async function addParticipant(
  database: DatabaseExecutor,
  access: AccessContext,
  room: Readonly<{ id: string; joinCode: string; subject: string }>,
  now: Date,
): Promise<GroupStudyMutationSummary> {
  const timer = await createTimerSessionRecord(
    database,
    access,
    room.subject,
    now,
  )
  if (!timer) {
    throw new TimerServiceError("INTERNAL_ERROR", "Your timer could not start.")
  }

  const participant = await createGroupStudyParticipantRecord(database, {
    groupSessionId: room.id,
    now,
    timerSessionId: timer.id,
    userId: access.userId,
  })
  if (!participant) {
    throw new TimerServiceError(
      "INTERNAL_ERROR",
      "You could not join this Group Study session.",
    )
  }

  await createGroupStudyActivityRecord(database, {
    action: "joined",
    groupSessionId: room.id,
    now,
    participantId: participant.id,
    timerElapsedMs: 0,
    userId: access.userId,
  })

  return {
    status: "joined" as const,
    joinCode: room.joinCode,
    roomId: room.id,
    subject: room.subject,
    timerSessionId: timer.id,
    timerVersion: timer.version,
  }
}

export async function createGroupStudySession(
  database: Database,
  access: AccessContext,
  input: Readonly<{ name: string; participantLimit: number; subject: string }>,
  now = new Date(),
) {
  return database.transaction(async (transaction) => {
    if (!(await lockWorkspaceForMutation(transaction, access))) {
      throw new TimerServiceError(
        "FORBIDDEN",
        "Workspace access is no longer active.",
      )
    }
    if (!(await roomQuotaAvailable(transaction, access.workspaceId))) {
      throw new TimerServiceError(
        "VALIDATION_ERROR",
        "This workspace has reached its active Group Study room quota.",
      )
    }
    if (!(await timerQuotaAvailable(transaction, access.workspaceId))) {
      throw new TimerServiceError(
        "VALIDATION_ERROR",
        "This workspace has reached its retained timer-session quota.",
      )
    }
    await requireAvailableTimer(transaction, access)

    const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000)
    const joinCode = await createUniqueJoinCode(transaction)
    const room = await createGroupStudySessionRecord(transaction, {
      expiresAt,
      hostUserId: access.userId,
      joinCode,
      name: input.name,
      now,
      participantLimit: input.participantLimit,
      subject: input.subject,
      workspaceId: access.workspaceId,
    })
    if (!room) {
      throw new TimerServiceError(
        "INTERNAL_ERROR",
        "The Group Study session could not be created.",
      )
    }

    return addParticipant(transaction, access, room, now)
  })
}

export async function joinGroupStudySession(
  database: Database,
  access: AccessContext,
  joinCode: string,
  now = new Date(),
) {
  return database.transaction(async (transaction) => {
    if (!(await lockWorkspaceForMutation(transaction, access))) {
      throw new TimerServiceError(
        "FORBIDDEN",
        "Workspace access is no longer active.",
      )
    }
    if (!(await timerQuotaAvailable(transaction, access.workspaceId))) {
      throw new TimerServiceError(
        "VALIDATION_ERROR",
        "This workspace has reached its retained timer-session quota.",
      )
    }
    await requireAvailableTimer(transaction, access)

    const found = await findGroupStudySessionByCode(
      transaction,
      access,
      joinCode,
    )
    if (!found) {
      throw new TimerServiceError(
        "NOT_FOUND",
        "That Group Study code is not active.",
      )
    }
    const room = await lockGroupStudySessionRecord(
      transaction,
      found.workspaceId,
      found.id,
    )
    if (!room || room.status !== "active") {
      throw new TimerServiceError(
        "NOT_FOUND",
        "That Group Study session has already ended.",
      )
    }

    if (room.expiresAt && now > room.expiresAt) {
      throw new TimerServiceError(
        "NOT_FOUND",
        "That Group Study session has expired.",
      )
    }

    if (room.joinLocked) {
      // Look up the latest request regardless of status: an approved request
      // must be consumable here, and a rejected one may be re-requested.
      const request = await findLatestJoinRequestForUser(
        transaction,
        room.id,
        access.userId,
      )
      if (!request || request.status === "rejected") {
        await createGroupStudyJoinRequestRecord(transaction, {
          groupSessionId: room.id,
          now,
          userId: access.userId,
        })
        return { status: "pending" as const, roomId: room.id }
      }
      if (request.status === "pending") {
        return { status: "pending" as const, roomId: room.id }
      }
      // Approved: consume the grant inside this join transaction so it can
      // never be replayed by a concurrent join attempt.
      const consumed = await consumeApprovedJoinRequest(transaction, {
        now,
        requestId: request.id,
      })
      if (!consumed) {
        throw new TimerServiceError(
          "CONFLICT",
          "Your join approval changed. Refresh and try again.",
        )
      }
    }
    if (
      await findGroupStudyBlock(
        transaction,
        room.workspaceId,
        room.id,
        access.userId,
      )
    ) {
      throw new TimerServiceError(
        "FORBIDDEN",
        "You have been blocked from this Group Study room.",
      )
    }
    if (
      (await countActiveGroupStudyParticipants(
        transaction,
        room.workspaceId,
        room.id,
      )) >= room.participantLimit
    ) {
      throw new TimerServiceError(
        "CONFLICT",
        "This Group Study room has reached its participant limit.",
      )
    }

    return addParticipant(transaction, access, room, now)
  })
}

function controlSummary(
  room: NonNullable<Awaited<ReturnType<typeof lockGroupStudySessionRecord>>>,
): GroupStudyControlSummary {
  return {
    joinCode: room.joinCode,
    joinLocked: room.joinLocked,
    name: room.name,
    participantLimit: room.participantLimit,
    roomId: room.id,
    subject: room.subject,
    version: room.version,
  }
}

async function requireHostRoom(
  database: DatabaseExecutor,
  access: AccessContext,
  roomId: string,
) {
  if (!(await lockWorkspaceForMutation(database, access))) {
    throw new TimerServiceError(
      "FORBIDDEN",
      "Workspace access is no longer active.",
    )
  }
  const authorizedRoom = await findGroupStudySessionRecord(
    database,
    access,
    roomId,
    false,
  )
  if (!authorizedRoom || authorizedRoom.status !== "active") {
    throw new TimerServiceError("NOT_FOUND", "This Group Study room has ended.")
  }
  // Guard: the caller's workspace must match the room's owning workspace.
  // This closes the loophole where access.workspaceId (personal workspace)
  // could diverge from the room's actual workspaceId.
  if (authorizedRoom.workspaceId !== access.workspaceId) {
    throw new TimerServiceError(
      "FORBIDDEN",
      "You do not have access to manage this Group Study room.",
    )
  }
  const room = await lockGroupStudySessionRecord(
    database,
    authorizedRoom.workspaceId,
    roomId,
  )
  if (!room || room.status !== "active") {
    throw new TimerServiceError("NOT_FOUND", "This Group Study room has ended.")
  }
  if (room.hostUserId !== access.userId) {
    throw new TimerServiceError(
      "FORBIDDEN",
      "Only the room host can change Group Study controls.",
    )
  }
  const membership = await findActiveGroupStudyParticipant(database, access)
  if (!membership || membership.groupSessionId !== room.id) {
    throw new TimerServiceError(
      "FORBIDDEN",
      "Only the active room host can change Group Study controls.",
    )
  }
  return room
}

export async function updateGroupStudySettings(
  database: Database,
  access: AccessContext,
  input: Readonly<{
    name: string
    participantLimit: number
    roomId: string
    subject: string
  }>,
  now = new Date(),
) {
  return database.transaction(async (transaction) => {
    const room = await requireHostRoom(transaction, access, input.roomId)
    const activeCount = await countActiveGroupStudyParticipants(
      transaction,
      access.workspaceId,
      room.id,
    )
    if (input.participantLimit < activeCount) {
      throw new TimerServiceError(
        "CONFLICT",
        `The participant limit cannot be lower than the ${activeCount} people currently studying.`,
      )
    }
    const updated = await updateGroupStudySessionRecord(transaction, {
      expectedVersion: room.version,
      groupSessionId: room.id,
      name: input.name,
      now,
      participantLimit: input.participantLimit,
      subject: input.subject,
      workspaceId: access.workspaceId,
    })
    if (!updated) {
      throw new TimerServiceError(
        "CONFLICT",
        "Room settings changed elsewhere. Refresh and try again.",
      )
    }
    return controlSummary(updated)
  })
}

export async function setGroupStudyJoinLocked(
  database: Database,
  access: AccessContext,
  input: Readonly<{ joinLocked: boolean; roomId: string }>,
  now = new Date(),
) {
  return database.transaction(async (transaction) => {
    const room = await requireHostRoom(transaction, access, input.roomId)
    const updated = await updateGroupStudySessionRecord(transaction, {
      expectedVersion: room.version,
      groupSessionId: room.id,
      joinLocked: input.joinLocked,
      now,
      workspaceId: access.workspaceId,
    })
    if (!updated) {
      throw new TimerServiceError("CONFLICT", "Room access changed elsewhere.")
    }
    return controlSummary(updated)
  })
}

export async function regenerateGroupStudyJoinCode(
  database: Database,
  access: AccessContext,
  roomId: string,
  now = new Date(),
) {
  return database.transaction(async (transaction) => {
    const room = await requireHostRoom(transaction, access, roomId)
    const joinCode = await createUniqueJoinCode(transaction)
    const updated = await updateGroupStudySessionRecord(transaction, {
      expectedVersion: room.version,
      groupSessionId: room.id,
      joinCode,
      now,
      workspaceId: access.workspaceId,
    })
    if (!updated) {
      throw new TimerServiceError(
        "CONFLICT",
        "The room code changed elsewhere.",
      )
    }
    return controlSummary(updated)
  })
}

export async function moderateGroupStudyParticipant(
  database: Database,
  access: AccessContext,
  input: Readonly<{
    action: Extract<GroupStudyActivityAction, "blocked" | "removed">
    participantId: string
    roomId: string
  }>,
  now = new Date(),
) {
  return database.transaction(async (transaction) => {
    const room = await requireHostRoom(transaction, access, input.roomId)
    const participant = await lockActiveGroupStudyParticipantForModeration(
      transaction,
      access.workspaceId,
      room.id,
      input.participantId,
    )
    if (!participant) {
      throw new TimerServiceError(
        "NOT_FOUND",
        "That participant has already left the room.",
      )
    }
    if (participant.userId === access.userId) {
      throw new TimerServiceError(
        "FORBIDDEN",
        "Use Stop & leave to end your own Group Study timer.",
      )
    }

    const elapsedMs = calculateTimerElapsedMs({
      accumulatedMs: participant.accumulatedMs,
      lastStartedAt: participant.lastStartedAt,
      nowMs: now.getTime(),
      status: participant.status,
    })
    const timer = await completeGroupStudyParticipantTimer(transaction, {
      accumulatedMs: elapsedMs,
      expectedVersion: participant.timerVersion,
      now,
      timerSessionId: participant.timerSessionId,
      userId: participant.userId,
      workspaceId: participant.timerWorkspaceId,
    })
    if (!timer) {
      throw new TimerServiceError(
        "CONFLICT",
        "That participant's timer changed. Refresh and try again.",
      )
    }
    const left = await markGroupStudyParticipantLeft(transaction, {
      now,
      participantId: participant.id,
      userId: participant.userId,
      workspaceId: access.workspaceId,
    })
    if (!left) {
      throw new TimerServiceError("CONFLICT", "That participant already left.")
    }
    if (input.action === "blocked") {
      await createGroupStudyBlockRecord(transaction, {
        blockedByUserId: access.userId,
        groupSessionId: room.id,
        now,
        userId: participant.userId,
      })
    }
    await createGroupStudyActivityRecord(transaction, {
      action: input.action,
      groupSessionId: room.id,
      now,
      participantId: participant.id,
      timerElapsedMs: elapsedMs,
      userId: participant.userId,
    })
    return controlSummary(room)
  })
}

export async function respondToJoinRequest(
  database: Database,
  access: AccessContext,
  input: Readonly<{
    action: "approve" | "reject"
    requestId: string
    roomId: string
  }>,
  now = new Date(),
) {
  return database.transaction(async (transaction) => {
    const room = await requireHostRoom(transaction, access, input.roomId)
    const request = await updateGroupStudyJoinRequestStatus(transaction, {
      now,
      requestId: input.requestId,
      status: input.action === "approve" ? "approved" : "rejected",
    })
    if (!request || request.groupSessionId !== room.id) {
      throw new TimerServiceError("NOT_FOUND", "Join request not found.")
    }

    if (input.action === "approve") {
      if (
        (await countActiveGroupStudyParticipants(
          transaction,
          room.workspaceId,
          room.id,
        )) >= room.participantLimit
      ) {
        throw new TimerServiceError(
          "CONFLICT",
          "This Group Study room has reached its participant limit.",
        )
      }

      // We don't have access to the user's actual AccessContext here,
      // but they might not even be active. Wait!
      // `addParticipant` requires `access: AccessContext` for the joining user,
      // but the caller of this function is the HOST!
      // This means the user must join themselves once approved, or we need to start their timer on their behalf.
      // Wait, if the host approves, the host can't start the participant's timer because the host doesn't have the participant's AccessContext.
      // So approval just changes the status to 'approved'. The participant must poll to see if they are approved, and THEN they call `joinGroupStudySession` again?
      // Or we can just bypass and let the participant poll, and if approved, the participant calls another action to finalize joining.
      // Actually, if we just update the status to 'approved', the participant's client can poll the request status, and if approved, it can automatically call `joinGroupStudySession` (which will bypass the lock check if we check for approved requests).
    }

    return controlSummary(room)
  })
}

export async function recordGroupStudyTimerAction(
  database: DatabaseExecutor,
  access: AccessContext,
  input: Readonly<{
    action: Extract<GroupStudyActivityAction, "paused" | "resumed">
    now: Date
    timerElapsedMs: number
    timerSessionId: string
  }>,
) {
  const participant = await findActiveGroupStudyParticipantForTimer(
    database,
    access,
    input.timerSessionId,
  )
  if (!participant) return

  await createGroupStudyActivityRecord(database, {
    action: input.action,
    groupSessionId: participant.groupSessionId,
    now: input.now,
    participantId: participant.id,
    timerElapsedMs: input.timerElapsedMs,
    userId: access.userId,
  })
}

export async function leaveGroupStudyForTimer(
  database: DatabaseExecutor,
  access: AccessContext,
  input: Readonly<{
    now: Date
    timerElapsedMs: number
    timerSessionId: string
  }>,
) {
  const participant = await findActiveGroupStudyParticipantForTimer(
    database,
    access,
    input.timerSessionId,
  )
  if (!participant) return

  const authorizedRoom = await findGroupStudySessionRecord(
    database,
    access,
    participant.groupSessionId,
  )
  if (!authorizedRoom) return
  const room = await lockGroupStudySessionRecord(
    database,
    authorizedRoom.workspaceId,
    participant.groupSessionId,
  )
  if (!room) return

  const left = await markGroupStudyParticipantLeft(database, {
    now: input.now,
    participantId: participant.id,
    userId: access.userId,
    workspaceId: room.workspaceId,
  })
  if (!left) return

  await createGroupStudyActivityRecord(database, {
    action: "left",
    groupSessionId: participant.groupSessionId,
    now: input.now,
    participantId: participant.id,
    timerElapsedMs: input.timerElapsedMs,
    userId: access.userId,
  })

  const remaining = await countActiveGroupStudyParticipants(
    database,
    room.workspaceId,
    participant.groupSessionId,
  )
  if (room.status === "active" && remaining === 0) {
    await closeGroupStudySessionRecord(database, {
      expectedVersion: room.version,
      groupSessionId: room.id,
      now: input.now,
      workspaceId: room.workspaceId,
    })
  } else if (room.status === "active" && room.hostUserId === access.userId) {
    await transferGroupStudyHostRecord(database, {
      departedUserId: access.userId,
      expectedVersion: room.version,
      groupSessionId: room.id,
      now: input.now,
      workspaceId: room.workspaceId,
    })
  }
}
