// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const authorizeCronRequest = vi.hoisted(() => vi.fn())
const getDatabase = vi.hoisted(() => vi.fn())
const purgeStaleDeletedTasks = vi.hoisted(() => vi.fn())
const deletePurgedTaskTombstones = vi.hoisted(() => vi.fn())
const deleteTerminalRemindersBefore = vi.hoisted(() => vi.fn())
const deleteExpiredAuthSessionsBefore = vi.hoisted(() => vi.fn())
const deleteJoinRequestsForSessionsEndedBefore = vi.hoisted(() => vi.fn())
const deleteActivityEventsBefore = vi.hoisted(() => vi.fn())

vi.mock("@/app/api/cron/cron-auth", () => ({ authorizeCronRequest }))
vi.mock("@/db/client", () => ({ getDatabase }))
vi.mock(
  "@/features/authentication/repositories/session-retention-repository",
  () => ({
    deleteExpiredAuthSessionsBefore,
  }),
)
vi.mock(
  "@/features/progression/repositories/activity-retention-repository",
  () => ({
    deleteActivityEventsBefore,
  }),
)
vi.mock("@/features/quests/repositories/task-retention-repository", () => ({
  deletePurgedTaskTombstones,
  purgeStaleDeletedTasks,
}))
vi.mock(
  "@/features/reminders/repositories/reminder-retention-repository",
  () => ({
    deleteTerminalRemindersBefore,
  }),
)
vi.mock(
  "@/features/timer/repositories/group-study-retention-repository",
  () => ({
    deleteJoinRequestsForSessionsEndedBefore,
  }),
)

import { GET, POST } from "@/app/api/cron/retention/route"

describe("retention sweep Route Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-20T03:17:00.000Z"))
    authorizeCronRequest.mockReturnValue(true)
    getDatabase.mockReturnValue({})
    purgeStaleDeletedTasks.mockResolvedValue(0)
    deletePurgedTaskTombstones.mockResolvedValue(0)
    deleteTerminalRemindersBefore.mockResolvedValue({
      inAppNotifications: 0,
      reminderDeliveries: 0,
      reminders: 0,
    })
    deleteExpiredAuthSessionsBefore.mockResolvedValue(0)
    deleteJoinRequestsForSessionsEndedBefore.mockResolvedValue(0)
    deleteActivityEventsBefore.mockResolvedValue(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("rejects requests without an authorized secret", async () => {
    authorizeCronRequest.mockReturnValue(false)

    const response = await POST(
      new Request("https://traketo.example.test/api/cron/retention", {
        method: "POST",
      }),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      message: "Unauthorized.",
    })
    expect(getDatabase).not.toHaveBeenCalled()
    expect(purgeStaleDeletedTasks).not.toHaveBeenCalled()
  })

  it("exposes per-table deleted counts and the purged task count", async () => {
    purgeStaleDeletedTasks.mockResolvedValue(3)
    deleteTerminalRemindersBefore.mockResolvedValue({
      inAppNotifications: 7,
      reminderDeliveries: 9,
      reminders: 5,
    })
    deleteExpiredAuthSessionsBefore.mockResolvedValue(2)
    deleteJoinRequestsForSessionsEndedBefore.mockResolvedValue(4)
    deleteActivityEventsBefore.mockResolvedValue(11)
    deletePurgedTaskTombstones.mockResolvedValue(1)

    const response = await GET(
      new Request("https://traketo.example.test/api/cron/retention"),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      deleted: {
        activityEvents: 11,
        groupStudyJoinRequests: 4,
        inAppNotifications: 7,
        reminderDeliveries: 9,
        reminders: 5,
        sessions: 2,
        tasks: 1,
      },
      partial: false,
      purgedTasks: 3,
    })

    expect(deleteTerminalRemindersBefore).toHaveBeenCalledWith(
      expect.anything(),
      new Date("2026-05-22T03:17:00.000Z"),
    )
    expect(deleteExpiredAuthSessionsBefore).toHaveBeenCalledWith(
      expect.anything(),
      new Date("2026-07-21T03:17:00.000Z"),
    )
    expect(deleteActivityEventsBefore).toHaveBeenCalledWith(
      expect.anything(),
      new Date("2025-08-20T03:17:00.000Z"),
    )
  })

  it("marks the run partial when the wall-clock budget is exhausted", async () => {
    const deadlineExceeded = new Date(
      new Date("2026-08-20T03:17:00.000Z").getTime() + 25_000 + 1,
    )
    purgeStaleDeletedTasks.mockImplementation(async () => {
      vi.setSystemTime(deadlineExceeded)
      return 0
    })

    const response = await GET(
      new Request("https://traketo.example.test/api/cron/retention"),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      deleted: {
        activityEvents: 0,
        groupStudyJoinRequests: 0,
        inAppNotifications: 0,
        reminderDeliveries: 0,
        reminders: 0,
        sessions: 0,
        tasks: 0,
      },
      partial: true,
      purgedTasks: 0,
    })
    expect(deleteTerminalRemindersBefore).not.toHaveBeenCalled()
  })
})
