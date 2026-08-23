import "server-only"

import type { Database, DatabaseExecutor } from "@/db/client"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { TimerServiceError } from "@/features/timer/domain/errors"
import { calculateTimerElapsedMs } from "@/features/timer/domain/timer"
import {
  leaveGroupStudyForTimer,
  recordGroupStudyTimerAction,
} from "@/features/timer/mutations/group-study-mutation-service"
import {
  createTimerSessionRecord,
  findActiveTimerSessionRecord,
  findTimerSessionRecord,
  updateTimerSessionRecord,
  type TimerSessionRecord,
} from "@/features/timer/repositories/timer-repository"
import { lockWorkspaceForMutation } from "@/features/workspaces/infrastructure/workspace-access-repository"
import { timerQuotaAvailable } from "@/lib/resource-quotas"

export type TimerMutationSummary = Readonly<{
  accumulatedMs: number
  endedAt: string | null
  id: string
  lastStartedAt: string | null
  status: TimerSessionRecord["status"]
  subject: string
  version: number
}>

type TimerTransition = Readonly<{
  expectedVersion: number
  sessionId: string
}>

function summary(record: TimerSessionRecord): TimerMutationSummary {
  return {
    accumulatedMs: record.accumulatedMs,
    endedAt: record.endedAt?.toISOString() ?? null,
    id: record.id,
    lastStartedAt: record.lastStartedAt?.toISOString() ?? null,
    status: record.status,
    subject: record.subject,
    version: record.version,
  }
}

function elapsedAt(record: TimerSessionRecord, now: Date) {
  return calculateTimerElapsedMs({
    accumulatedMs: record.accumulatedMs,
    lastStartedAt: record.lastStartedAt,
    nowMs: now.getTime(),
    status: record.status,
  })
}

function withTimerMutation<T>(
  database: Database,
  access: AccessContext,
  mutate: (transaction: DatabaseExecutor) => Promise<T>,
) {
  return database.transaction(async (transaction) => {
    if (!(await lockWorkspaceForMutation(transaction, access))) {
      throw new TimerServiceError(
        "FORBIDDEN",
        "Workspace access is no longer active.",
      )
    }

    return mutate(transaction)
  })
}

async function requireSession(
  database: DatabaseExecutor,
  access: AccessContext,
  sessionId: string,
) {
  const record = await findTimerSessionRecord(database, access, sessionId)
  if (!record) {
    throw new TimerServiceError("NOT_FOUND", "Timer session not found.")
  }
  return record
}

function conflict(): never {
  throw new TimerServiceError(
    "CONFLICT",
    "This timer changed elsewhere. Refresh and try again.",
  )
}

export async function startTimer(
  database: Database,
  access: AccessContext,
  subject: string,
  now = new Date(),
) {
  return withTimerMutation(database, access, async (transaction) => {
    if (!(await timerQuotaAvailable(transaction, access.workspaceId))) {
      throw new TimerServiceError(
        "VALIDATION_ERROR",
        "This workspace has reached its retained timer-session quota.",
      )
    }
    if (await findActiveTimerSessionRecord(transaction, access)) {
      throw new TimerServiceError(
        "CONFLICT",
        "Pause or finish the current timer before starting another session.",
      )
    }

    const record = await createTimerSessionRecord(
      transaction,
      access,
      subject,
      now,
    )
    if (!record) {
      throw new TimerServiceError("INTERNAL_ERROR", "Timer could not start.")
    }
    return summary(record)
  })
}

export async function pauseTimer(
  database: Database,
  access: AccessContext,
  command: TimerTransition,
  now = new Date(),
) {
  return withTimerMutation(database, access, async (transaction) => {
    const current = await requireSession(transaction, access, command.sessionId)
    if (
      current.version !== command.expectedVersion ||
      current.status !== "running"
    ) {
      return conflict()
    }

    const updated = await updateTimerSessionRecord(transaction, access, {
      accumulatedMs: elapsedAt(current, now),
      expectedVersion: command.expectedVersion,
      lastStartedAt: null,
      sessionId: command.sessionId,
      status: "paused",
      updatedAt: now,
    })
    if (!updated) return conflict()
    await recordGroupStudyTimerAction(transaction, access, {
      action: "paused",
      now,
      timerElapsedMs: updated.accumulatedMs,
      timerSessionId: updated.id,
    })
    return summary(updated)
  })
}

export async function resumeTimer(
  database: Database,
  access: AccessContext,
  command: TimerTransition,
  now = new Date(),
) {
  return withTimerMutation(database, access, async (transaction) => {
    const current = await requireSession(transaction, access, command.sessionId)
    if (
      current.version !== command.expectedVersion ||
      current.status !== "paused"
    ) {
      return conflict()
    }

    const updated = await updateTimerSessionRecord(transaction, access, {
      expectedVersion: command.expectedVersion,
      lastStartedAt: now,
      sessionId: command.sessionId,
      status: "running",
      updatedAt: now,
    })
    if (!updated) return conflict()
    await recordGroupStudyTimerAction(transaction, access, {
      action: "resumed",
      now,
      timerElapsedMs: updated.accumulatedMs,
      timerSessionId: updated.id,
    })
    return summary(updated)
  })
}

export async function stopTimer(
  database: Database,
  access: AccessContext,
  command: TimerTransition,
  now = new Date(),
) {
  return withTimerMutation(database, access, async (transaction) => {
    const current = await requireSession(transaction, access, command.sessionId)
    if (
      current.version !== command.expectedVersion ||
      current.status === "completed"
    ) {
      return conflict()
    }

    const updated = await updateTimerSessionRecord(transaction, access, {
      accumulatedMs: elapsedAt(current, now),
      endedAt: now,
      expectedVersion: command.expectedVersion,
      lastStartedAt: null,
      sessionId: command.sessionId,
      status: "completed",
      updatedAt: now,
    })
    if (!updated) return conflict()
    await leaveGroupStudyForTimer(transaction, access, {
      now,
      timerElapsedMs: updated.accumulatedMs,
      timerSessionId: updated.id,
    })
    return summary(updated)
  })
}

export async function stopActiveTimer(
  database: Database,
  access: AccessContext,
  sessionId: string,
  now = new Date(),
) {
  return withTimerMutation(database, access, async (transaction) => {
    const current = await findActiveTimerSessionRecord(transaction, access)
    if (!current || current.id !== sessionId) return null

    const updated = await updateTimerSessionRecord(transaction, access, {
      accumulatedMs: elapsedAt(current, now),
      endedAt: now,
      expectedVersion: current.version,
      lastStartedAt: null,
      sessionId,
      status: "completed",
      updatedAt: now,
    })
    if (!updated) return null
    await leaveGroupStudyForTimer(transaction, access, {
      now,
      timerElapsedMs: updated.accumulatedMs,
      timerSessionId: updated.id,
    })
    return summary(updated)
  })
}

export async function editTimerSubject(
  database: Database,
  access: AccessContext,
  command: TimerTransition & Readonly<{ subject: string }>,
  now = new Date(),
) {
  return withTimerMutation(database, access, async (transaction) => {
    const current = await requireSession(transaction, access, command.sessionId)
    if (current.version !== command.expectedVersion) return conflict()

    const updated = await updateTimerSessionRecord(transaction, access, {
      expectedVersion: command.expectedVersion,
      sessionId: command.sessionId,
      subject: command.subject,
      updatedAt: now,
    })
    return updated ? summary(updated) : conflict()
  })
}
