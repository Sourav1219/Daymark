import { NextResponse } from "next/server"

import { getDatabase } from "@/db/client"
import { timerSessions } from "@/db/schema"
import { eq, and, lte } from "drizzle-orm"
import { calculateTimerElapsedMs } from "@/features/timer/domain/timer"
import { authorizeCronRequest } from "@/app/api/cron/cron-auth"

export const dynamic = "force-dynamic"

/** Max allowed duration for an unrecoverable solitary timer before it is capped. */
const MAX_TIMER_DURATION_MS = 12 * 60 * 60 * 1_000 // 12 hours

/** Whole-job wall-clock budget; remaining timers are left for the next run. */
const JOB_BUDGET_MS = 25_000

/**
 * Cron job: clean up unrecoverable running timers.
 *
 * Finds timer sessions that have been running for > 12 hours and auto-stops them,
 * capping the duration to avoid infinite accrual. Vercel Cron invokes this
 * path with GET; POST is kept for alternate schedulers and tests.
 */
export async function GET(request: Request) {
  return runStaleTimersCleanup(request)
}

export async function POST(request: Request) {
  return runStaleTimersCleanup(request)
}

async function runStaleTimersCleanup(request: Request) {
  if (!authorizeCronRequest(request, "stale-timers")) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 })
  }

  const database = getDatabase()
  const now = new Date()
  const cutoff = new Date(now.getTime() - MAX_TIMER_DURATION_MS)
  const deadline = now.getTime() + JOB_BUDGET_MS

  let closed = 0
  let partial = false

  const staleTimers = await database
    .select({
      id: timerSessions.id,
      accumulatedMs: timerSessions.accumulatedMs,
      lastStartedAt: timerSessions.lastStartedAt,
      version: timerSessions.version,
    })
    .from(timerSessions)
    .where(
      and(
        eq(timerSessions.status, "running"),
        lte(timerSessions.lastStartedAt, cutoff),
      ),
    )

  for (const timer of staleTimers) {
    if (Date.now() >= deadline) {
      partial = true
      break
    }
    if (!timer.lastStartedAt) continue

    const elapsedMs = calculateTimerElapsedMs({
      accumulatedMs: timer.accumulatedMs,
      lastStartedAt: timer.lastStartedAt,
      nowMs: now.getTime(),
      status: "running",
    })

    const cappedMs = Math.min(elapsedMs, MAX_TIMER_DURATION_MS)
    const currentRunMs = Math.max(0, cappedMs - timer.accumulatedMs)

    const [updated] = await database
      .update(timerSessions)
      .set({
        // calculateTimerElapsedMs already includes accumulatedMs. Persist the
        // capped total directly instead of adding the prior elapsed time again.
        accumulatedMs: cappedMs,
        endedAt: new Date(timer.lastStartedAt.getTime() + currentRunMs),
        status: "completed",
        updatedAt: now,
        version: timer.version + 1,
      })
      .where(
        and(
          eq(timerSessions.id, timer.id),
          eq(timerSessions.version, timer.version),
        ),
      )
      .returning({ id: timerSessions.id })

    if (updated) {
      closed++
    }
  }

  return NextResponse.json({ closed, partial, stale: staleTimers.length })
}
