// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  requireWorkspaceAccess: vi.fn(),
  getUserSettings: vi.fn(),
  editQuestSchedule: vi.fn(),
  enforceRateLimit: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("@/db/client", () => ({ getDatabase: mocks.getDatabase }))
vi.mock("@/features/authentication/server/authorization", () => ({
  requireWorkspaceAccess: mocks.requireWorkspaceAccess,
}))
vi.mock("@/features/reminders/queries/user-settings-query-service", () => ({
  getUserSettings: mocks.getUserSettings,
}))
vi.mock("@/features/quests/mutations/quest-mutation-service", () => ({
  editQuestSchedule: mocks.editQuestSchedule,
}))
vi.mock("@/lib/rate-limit/rate-limiter", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))
vi.mock("@/lib/observability/request-context", () => ({
  resolveRequestId: vi.fn().mockResolvedValue("request"),
}))

import { editQuestScheduleAction } from "@/features/quests/application/actions"
import { QuestServiceError } from "@/features/quests/domain/errors"

const access = { userId: "user", workspaceId: "workspace", role: "owner" }
const database = {}
const input = {
  expectedVersion: 4,
  questId: "00000000-0000-4000-8000-000000000001",
  dueAt: "2026-11-01T09:30",
}

describe("editQuestScheduleAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getDatabase.mockReturnValue(database)
    mocks.requireWorkspaceAccess.mockResolvedValue(access)
    mocks.getUserSettings.mockResolvedValue({ timezone: "Asia/Kolkata" })
    mocks.enforceRateLimit.mockResolvedValue(null)
    mocks.editQuestSchedule.mockResolvedValue({ id: input.questId, version: 5 })
  })

  it("uses authenticated settings, preserves omissions, and refreshes lifecycle paths", async () => {
    await expect(editQuestScheduleAction(input)).resolves.toEqual({
      ok: true,
      data: { id: input.questId, version: 5 },
    })
    expect(mocks.requireWorkspaceAccess).toHaveBeenCalledOnce()
    expect(mocks.getUserSettings).toHaveBeenCalledWith(access)
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      policy: "default",
      userId: access.userId,
    })
    expect(mocks.editQuestSchedule).toHaveBeenCalledExactlyOnceWith(
      database,
      access,
      {
        ...input,
        dueAt: new Date("2026-11-01T04:00:00Z"),
      },
    )
    expect(mocks.revalidatePath.mock.calls).toEqual([
      ["/quests"],
      ["/today"],
      ["/cleared"],
      ["/gates"],
    ])
  })

  it("returns field validation failures without mutating", async () => {
    await expect(
      editQuestScheduleAction({ ...input, dueAt: "" }),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        fieldErrors: { dueAt: expect.any(Array) },
      },
    })
    expect(mocks.editQuestSchedule).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it("does not mutate or refresh when rate limited", async () => {
    mocks.enforceRateLimit.mockResolvedValue({ success: false })
    await expect(editQuestScheduleAction(input)).resolves.toMatchObject({
      ok: false,
      error: { code: "RATE_LIMITED" },
    })
    expect(mocks.editQuestSchedule).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it("returns standard service conflicts without refreshing", async () => {
    mocks.editQuestSchedule.mockRejectedValue(
      new QuestServiceError("CONFLICT", "Refresh and try again."),
    )
    await expect(editQuestScheduleAction(input)).resolves.toEqual({
      ok: false,
      error: { code: "CONFLICT", message: "Refresh and try again." },
    })
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it("requires authentication before loading settings or mutating", async () => {
    mocks.requireWorkspaceAccess.mockRejectedValue(
      new Error("Authentication required"),
    )
    await expect(editQuestScheduleAction(input)).rejects.toThrow(
      "Authentication required",
    )
    expect(mocks.getUserSettings).not.toHaveBeenCalled()
    expect(mocks.editQuestSchedule).not.toHaveBeenCalled()
  })
})
