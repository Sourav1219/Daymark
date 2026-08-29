import { NextResponse } from "next/server"

import { getDatabase } from "@/db/client"
import { authorizeCronRequest } from "@/app/api/cron/cron-auth"
import { deleteExpiredAuthSessionsBefore } from "@/features/authentication/repositories/session-retention-repository"
import { observeCronOutcome } from "@/lib/observability/metrics"
import { deleteActivityEventsBefore } from "@/features/progression/repositories/activity-retention-repository"
import { deleteTerminalRemindersBefore } from "@/features/reminders/repositories/reminder-retention-repository"
import {
  deletePurgedTaskTombstones,
  purgeStaleDeletedTasks,
} from "@/features/quests/repositories/task-retention-repository"
import { deleteJoinRequestsForSessionsEndedBefore } from "@/features/timer/repositories/group-study-retention-repository"
import { trashRetentionMilliseconds } from "@/features/quests/domain/types"

export const dynamic = "force-dynamic"

/** Trash rows older than this are auto-purged, matching permanent delete. */
/** Fully purged tombstones are hard deleted after a second grace period. */
const TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000

const TERMINAL_REMINDER_RETENTION_MS = 90 * 24 * 60 * 60 * 1_000

const EXPIRED_SESSION_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000

const ENDED_ROOM_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000

const ACTIVITY_EVENT_RETENTION_MS = 365 * 24 * 60 * 60 * 1_000

/** Whole-job wall-clock budget; remaining tables are left for the next run. */
const JOB_BUDGET_MS = 25_000

/**
 * Cron job: global retention sweep for expired rows.
 *
 * Hard deletes only data that is already terminal or expired: purged quest
 * tombstones, terminal reminders with their deliveries and notifications,
 * long-expired auth sessions, join requests of ended group rooms, and
 * unreferenced activity events. Active rows are never touched. Vercel Cron
 * invokes this path with GET; POST is kept for alternate schedulers.
 */
export async function GET(request: Request) {
  return runRetentionSweep(request)
}

export async function POST(request: Request) {
  return runRetentionSweep(request)
}

async function runRetentionSweep(request: Request) {
  if (!authorizeCronRequest(request, "retention")) {
    observeCronOutcome("retention", "denied")
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 })
  }

  const database = getDatabase()
  const now = new Date()
  const deadline = now.getTime() + JOB_BUDGET_MS

  const deleted = {
    activityEvents: 0,
    groupStudyJoinRequests: 0,
    inAppNotifications: 0,
    reminderDeliveries: 0,
    reminders: 0,
    sessions: 0,
    tasks: 0,
  }
  let purgedTasks = 0
  let partial = false

  const steps = [
    async () => {
      purgedTasks = await purgeStaleDeletedTasks(
        database,
        new Date(now.getTime() - trashRetentionMilliseconds),
        now,
      )
    },
    async () => {
      const result = await deleteTerminalRemindersBefore(
        database,
        new Date(now.getTime() - TERMINAL_REMINDER_RETENTION_MS),
      )
      deleted.reminders = result.reminders
      deleted.reminderDeliveries = result.reminderDeliveries
      deleted.inAppNotifications = result.inAppNotifications
    },
    async () => {
      deleted.sessions = await deleteExpiredAuthSessionsBefore(
        database,
        new Date(now.getTime() - EXPIRED_SESSION_RETENTION_MS),
      )
    },
    async () => {
      deleted.groupStudyJoinRequests =
        await deleteJoinRequestsForSessionsEndedBefore(
          database,
          new Date(now.getTime() - ENDED_ROOM_RETENTION_MS),
        )
    },
    async () => {
      deleted.activityEvents = await deleteActivityEventsBefore(
        database,
        new Date(now.getTime() - ACTIVITY_EVENT_RETENTION_MS),
      )
    },
    async () => {
      deleted.tasks += await deletePurgedTaskTombstones(
        database,
        new Date(now.getTime() - TOMBSTONE_RETENTION_MS),
      )
    },
  ]

  for (const step of steps) {
    if (Date.now() >= deadline) {
      partial = true
      break
    }
    await step()
  }

  observeCronOutcome("retention", partial ? "partial" : "success")

  return NextResponse.json(
    { deleted, purgedTasks, partial },
    { headers: { "Cache-Control": "no-store" } },
  )
}
