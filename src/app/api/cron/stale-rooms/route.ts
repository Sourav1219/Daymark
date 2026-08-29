import { NextResponse } from "next/server"

import { getDatabase } from "@/db/client"
import {
  closeGroupStudySessionRecord,
  countActiveGroupStudyParticipants,
  findStaleParticipants,
  markGroupStudyParticipantLeft,
  lockGroupStudySessionRecord,
  createGroupStudyActivityRecord,
} from "@/features/timer/repositories/group-study-repository"
import { completeGroupStudyParticipantTimer } from "@/features/timer/repositories/group-study-repository"
import { calculateTimerElapsedMs } from "@/features/timer/domain/timer"
import { authorizeCronRequest } from "@/app/api/cron/cron-auth"
import { logger } from "@/lib/observability/logger"
import { observeCronOutcome } from "@/lib/observability/metrics"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** Participants whose heartbeat is older than this are considered disconnected. */
const STALE_THRESHOLD_MS = 5 * 60 * 1_000 // 5 minutes

/** Whole-job wall-clock budget; remaining participants are left for the next run. */
const JOB_BUDGET_MS = 25_000

/**
 * Cron job: clean up zombie Group Study rooms.
 *
 * Runs periodically (every 5 minutes in vercel.json). Vercel Cron invokes
 * this path with GET and `Authorization: Bearer $CRON_SECRET`; POST is kept
 * for alternate schedulers and tests.
 */
export async function GET(request: Request) {
  return runStaleRoomsCleanup(request)
}

export async function POST(request: Request) {
  return runStaleRoomsCleanup(request)
}

async function runStaleRoomsCleanup(request: Request) {
  if (!authorizeCronRequest(request, "stale-rooms")) {
    observeCronOutcome("stale-rooms", "denied")
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 })
  }

  const database = getDatabase()
  const now = new Date()
  const cutoff = new Date(now.getTime() - STALE_THRESHOLD_MS)
  const deadline = now.getTime() + JOB_BUDGET_MS

  const staleParticipants = await findStaleParticipants(database, cutoff)

  let evicted = 0
  let failed = 0
  let roomsClosed = 0
  let processed = 0
  let partial = false

  for (const participant of staleParticipants) {
    if (Date.now() >= deadline) {
      partial = true
      break
    }
    processed += 1
    try {
      await database.transaction(async (transaction) => {
        const room = await lockGroupStudySessionRecord(
          transaction,
          participant.workspaceId,
          participant.groupSessionId,
        )
        if (!room || room.status !== "active") return

        const elapsedMs = calculateTimerElapsedMs({
          accumulatedMs: participant.accumulatedMs,
          lastStartedAt: participant.lastStartedAt,
          nowMs: now.getTime(),
          status: participant.status,
        })

        // Complete the timer for this participant.
        const timer = await completeGroupStudyParticipantTimer(transaction, {
          accumulatedMs: elapsedMs,
          expectedVersion: participant.timerVersion,
          now,
          timerSessionId: participant.timerSessionId,
          userId: participant.userId,
          workspaceId: participant.timerWorkspaceId,
        })
        if (!timer) return // Timer already completed — skip.

        // Mark the participant as left.
        const left = await markGroupStudyParticipantLeft(transaction, {
          now,
          participantId: participant.id,
          userId: participant.userId,
          workspaceId: participant.workspaceId,
        })
        if (!left) return

        evicted++

        // Record a "left" activity event so the UI shows the departure.
        await createGroupStudyActivityRecord(transaction, {
          action: "left",
          groupSessionId: participant.groupSessionId,
          now,
          participantId: participant.id,
          timerElapsedMs: elapsedMs,
          userId: participant.userId,
        })

        // Close the room if it now has no active participants.
        const remaining = await countActiveGroupStudyParticipants(
          transaction,
          participant.workspaceId,
          participant.groupSessionId,
        )
        if (remaining === 0) {
          await closeGroupStudySessionRecord(transaction, {
            expectedVersion: room.version,
            groupSessionId: room.id,
            now,
            workspaceId: participant.workspaceId,
          })
          roomsClosed++
        }
      })
    } catch (error) {
      // Continue with the rest of the batch, but never report a fully failed
      // sweep as a healthy no-op.
      failed++
      logger.error(
        "Stale room participant could not be evicted",
        error instanceof Error ? error : undefined,
        { participant_id: participant.id },
      )
    }
  }

  observeCronOutcome(
    "stale-rooms",
    failed > 0 ? "failure" : partial ? "partial" : "success",
  )

  return NextResponse.json(
    {
      evicted,
      failed,
      partial,
      processed,
      roomsClosed,
      stale: staleParticipants.length,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
