// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Database, DatabaseExecutor } from "@/db/client"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import type { QuestRecord } from "@/features/quests/repositories/quest-repository"

const mocks = vi.hoisted(() => ({
  findQuestRecord: vi.fn(),
  updateQuestRecord: vi.fn(),
  findUserSettingsRecord: vi.fn(),
  lockWorkspaceForMutation: vi.fn(),
}))

vi.mock("@/features/quests/repositories/quest-repository", () => ({
  findQuestRecord: mocks.findQuestRecord,
  updateQuestRecord: mocks.updateQuestRecord,
}))
vi.mock("@/features/reminders/repositories/user-settings-repository", () => ({
  findUserSettingsRecord: mocks.findUserSettingsRecord,
}))
vi.mock(
  "@/features/workspaces/infrastructure/workspace-access-repository",
  () => ({
    lockWorkspaceForMutation: mocks.lockWorkspaceForMutation,
  }),
)

import { editQuestSchedule } from "@/features/quests/mutations/quest-mutation-service"

const access: AccessContext = {
  userId: "user",
  workspaceId: "workspace",
  role: "owner",
}
const transaction = { execute: vi.fn() }
const database = {
  transaction: vi.fn(
    (mutate: (executor: DatabaseExecutor) => Promise<unknown>) =>
      mutate(transaction as unknown as DatabaseExecutor),
  ),
} as unknown as Database
const current: QuestRecord = {
  id: "00000000-0000-4000-8000-000000000001",
  version: 4,
  title: "Keep my title",
  description: "Keep my description",
  priority: "critical",
  status: "open",
  position: 7,
  taskType: "custom",
  customType: "Training",
  typeManual: true,
  startAt: new Date("2026-11-01T06:30:45.123Z"),
  dueAt: new Date("2026-11-01T08:00:12.456Z"),
  recurrenceRule: null,
  recurrenceOccurrenceAt: null,
  recurrenceSequence: null,
  recurrenceSeriesId: null,
  recurrenceTimezone: null,
  offlineMutationId: "offline-mutation",
  xpReward: 15,
  completedAt: null,
  deletedAt: null,
  projectId: "project",
  parentTaskId: "parent",
}
const command = { expectedVersion: current.version, questId: current.id }

describe("editQuestSchedule", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-31T12:00:00Z"))
    mocks.findQuestRecord.mockResolvedValue(current)
    mocks.lockWorkspaceForMutation.mockResolvedValue(true)
    mocks.findUserSettingsRecord.mockResolvedValue({
      timezone: "America/New_York",
    })
    mocks.updateQuestRecord.mockImplementation(
      async (_db, _access, _id, _version, changes) => ({
        ...current,
        ...changes,
        version: current.version + 1,
      }),
    )
  })

  afterEach(() => vi.useRealTimers())

  it.each(["startAt", "dueAt"] as const)(
    "writes only changed %s and preserves every unrelated field",
    async (key) => {
      const changes = { [key]: null }
      await expect(
        editQuestSchedule(database, access, { ...command, ...changes }),
      ).resolves.toEqual({
        id: current.id,
        version: 5,
      })
      expect(transaction.execute).toHaveBeenCalledOnce()
      expect(mocks.lockWorkspaceForMutation).toHaveBeenCalledWith(
        transaction,
        access,
      )
      expect(mocks.findQuestRecord).toHaveBeenCalledWith(
        transaction,
        access,
        current.id,
      )
      expect(mocks.updateQuestRecord).toHaveBeenCalledExactlyOnceWith(
        transaction,
        access,
        current.id,
        current.version,
        changes,
        "active",
        "open",
      )
      expect(mocks.findUserSettingsRecord).not.toHaveBeenCalled()
    },
  )

  it.each([
    { dueAt: new Date("2026-11-01T06:30:00Z") },
    { startAt: new Date("2026-11-01T08:00:13Z") },
  ])(
    "validates partial changes against exact persisted instants: %o",
    async (changes) => {
      await expect(
        editQuestSchedule(database, access, { ...command, ...changes }),
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        message: "Due time cannot be earlier than start time.",
      })
      expect(mocks.updateQuestRecord).not.toHaveBeenCalled()
    },
  )

  it("rejects elapsed schedule changes that have already passed", async () => {
    await expect(
      editQuestSchedule(database, access, {
        ...command,
        startAt: new Date("2026-10-31T11:00:00Z"),
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "That start time has already passed. Pick a later time.",
    })

    await expect(
      editQuestSchedule(database, access, {
        ...command,
        dueAt: new Date("2026-10-31T11:30:00Z"),
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "That due time has already passed. Pick a later time.",
    })
  })

  it("accepts equal instants and clearing both nonrecurring timestamps", async () => {
    await editQuestSchedule(database, access, {
      ...command,
      dueAt: current.startAt,
    })
    await editQuestSchedule(database, access, {
      ...command,
      startAt: null,
      dueAt: null,
    })
    expect(mocks.updateQuestRecord).toHaveBeenCalledTimes(2)
  })

  it("reanchors recurring tasks without round-tripping the omitted ambiguous instant", async () => {
    const recurring = {
      ...current,
      recurrenceRule: "FREQ=DAILY",
      recurrenceOccurrenceAt: current.dueAt,
      recurrenceSeriesId: "series",
      recurrenceSequence: 3,
      recurrenceTimezone: "UTC",
    }
    mocks.findQuestRecord.mockResolvedValue(recurring)
    await editQuestSchedule(database, access, { ...command, dueAt: null })
    expect(mocks.updateQuestRecord).toHaveBeenCalledExactlyOnceWith(
      transaction,
      access,
      current.id,
      current.version,
      {
        dueAt: null,
        recurrenceOccurrenceAt: current.startAt,
        recurrenceRule: recurring.recurrenceRule,
        recurrenceSeriesId: recurring.recurrenceSeriesId,
        recurrenceSequence: recurring.recurrenceSequence,
        recurrenceTimezone: "America/New_York",
      },
      "active",
      "open",
    )
    expect(
      mocks.updateQuestRecord.mock.calls[0]?.[4].recurrenceOccurrenceAt,
    ).toBe(current.startAt)
  })

  it("rejects clearing the last recurring anchor", async () => {
    mocks.findQuestRecord.mockResolvedValue({
      ...current,
      startAt: null,
      recurrenceRule: "FREQ=DAILY",
    })
    await expect(
      editQuestSchedule(database, access, { ...command, dueAt: null }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Recurring tasks need a start or due time.",
    })
    expect(mocks.updateQuestRecord).not.toHaveBeenCalled()
  })

  it.each([
    { status: "completed" },
    { status: "failed" },
    { dueAt: new Date("2026-10-31T11:59:59Z") },
  ])(
    "rejects closed or elapsed tasks before clearing a deadline: %o",
    async (changes) => {
      mocks.findQuestRecord.mockResolvedValue({ ...current, ...changes })
      await expect(
        editQuestSchedule(database, access, { ...command, dueAt: null }),
      ).rejects.toMatchObject({ code: "CONFLICT" })
      expect(mocks.updateQuestRecord).not.toHaveBeenCalled()
    },
  )

  it("rejects stale versions before writing", async () => {
    await expect(
      editQuestSchedule(database, access, {
        ...command,
        expectedVersion: 3,
        dueAt: null,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" })
    expect(mocks.updateQuestRecord).not.toHaveBeenCalled()
  })

  it("reports an optimistic write conflict", async () => {
    mocks.updateQuestRecord.mockResolvedValue(null)
    await expect(
      editQuestSchedule(database, access, { ...command, dueAt: null }),
    ).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("rejects missing or inaccessible tasks", async () => {
    mocks.findQuestRecord.mockResolvedValue(null)
    await expect(
      editQuestSchedule(database, access, { ...command, dueAt: null }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect(mocks.updateQuestRecord).not.toHaveBeenCalled()
  })

  it("rejects revoked workspace access before reading tasks", async () => {
    mocks.lockWorkspaceForMutation.mockResolvedValue(false)
    await expect(
      editQuestSchedule(database, access, { ...command, dueAt: null }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(mocks.findQuestRecord).not.toHaveBeenCalled()
    expect(mocks.updateQuestRecord).not.toHaveBeenCalled()
  })
})
