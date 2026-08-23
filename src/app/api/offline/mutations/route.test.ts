// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { QuestServiceError } from "@/features/quests/domain/errors"

const {
  completeQuest,
  createQuest,
  editQuest,
  findQuestRecord,
  getDatabase,
  getUserSettings,
  parseCreateQuestForm,
  parseEditQuestForm,
  reopenQuest,
  requireWorkspaceAccess,
  softDeleteQuest,
} = vi.hoisted(() => ({
  completeQuest: vi.fn(),
  createQuest: vi.fn(),
  editQuest: vi.fn(),
  findQuestRecord: vi.fn(),
  getDatabase: vi.fn(),
  getUserSettings: vi.fn(),
  parseCreateQuestForm: vi.fn(),
  parseEditQuestForm: vi.fn(),
  reopenQuest: vi.fn(),
  requireWorkspaceAccess: vi.fn(),
  softDeleteQuest: vi.fn(),
}))

vi.mock("@/db/client", () => ({ getDatabase }))
vi.mock("@/features/authentication/server/authorization", () => ({
  requireWorkspaceAccess,
}))
vi.mock("@/features/reminders/queries/user-settings-query-service", () => ({
  getUserSettings,
}))
vi.mock("@/features/quests/mutations/quest-mutation-service", () => ({
  completeQuest,
  createQuest,
  editQuest,
  reopenQuest,
  softDeleteQuest,
}))
vi.mock("@/features/quests/repositories/quest-repository", () => ({
  findQuestRecord,
}))
vi.mock("@/features/quests/validation/quest-validation", () => ({
  parseCreateQuestForm,
  parseEditQuestForm,
}))

import { POST } from "./route"

const workspaceId = "11111111-1111-4111-8111-111111111111"
const questId = "22222222-2222-4222-8222-222222222222"
const mutationId = "33333333-3333-4333-8333-333333333333"

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://questly.test/api/offline/mutations", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
    method: "POST",
  })
}

describe("offline mutation replay route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDatabase.mockReturnValue({})
    requireWorkspaceAccess.mockResolvedValue({
      role: "owner",
      userId: "44444444-4444-4444-8444-444444444444",
      workspaceId,
    })
    getUserSettings.mockResolvedValue({ timezone: "UTC", version: 1 })
  })

  it("rejects cross-site and malformed requests before application services", async () => {
    const crossSite = await POST(
      request(
        {},
        { origin: "https://attacker.test", "sec-fetch-site": "cross-site" },
      ),
    )
    expect(crossSite.status).toBe(403)
    expect(requireWorkspaceAccess).not.toHaveBeenCalled()

    const invalid = await POST(request({ type: "complete" }))
    expect(invalid.status).toBe(422)
    expect(requireWorkspaceAccess).not.toHaveBeenCalled()
  })

  it("rejects malformed origins without throwing", async () => {
    const response = await POST(request({}, { origin: "not a URL" }))

    expect(response.status).toBe(403)
    expect(requireWorkspaceAccess).not.toHaveBeenCalled()
  })

  it("enforces media type and the body cap without relying on Content-Length", async () => {
    const wrongMediaType = await POST(
      request({}, { "content-type": "text/plain" }),
    )
    expect(wrongMediaType.status).toBe(415)

    const oversized = await POST(request({ padding: "x".repeat(32_768) }))
    expect(oversized.status).toBe(413)
    expect(requireWorkspaceAccess).not.toHaveBeenCalled()
  })

  it("accepts the browser origin supplied through trusted proxy headers", async () => {
    // The Host/x-forwarded-host fallback is a development-only convenience.
    vi.stubEnv("NODE_ENV", "development")
    const response = await POST(
      request(
        { type: "complete" },
        {
          host: "localhost:3001",
          origin: "http://127.0.0.1:3001",
          "sec-fetch-site": "same-origin",
          "x-forwarded-host": "127.0.0.1:3001",
          "x-forwarded-proto": "http",
        },
      ),
    )

    expect(response.status).toBe(422)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("revalidates and applies a queued creation with its idempotency UUID", async () => {
    const payload = {
      description: "",
      dueAt: "",
      parentTaskId: "",
      priority: "medium",
      projectId: "",
      recurrenceRule: "",
      startAt: "",
      title: "Queued Quest",
    }
    parseCreateQuestForm.mockReturnValue({
      data: {
        ...payload,
        dueAt: null,
        parentTaskId: null,
        projectId: null,
        startAt: null,
      },
      success: true,
    })
    createQuest.mockResolvedValue({ id: questId, version: 1 })

    const response = await POST(
      request({ id: mutationId, payload, type: "create", workspaceId }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      mutationId,
      status: "applied",
    })
    expect(createQuest).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ workspaceId }),
      expect.any(Object),
      mutationId,
    )
    expect(response.headers.get("cache-control")).toContain("no-store")
  })

  it("returns the latest server version instead of overwriting a conflict", async () => {
    completeQuest.mockRejectedValue(
      new QuestServiceError("CONFLICT", "Stale version."),
    )
    findQuestRecord.mockResolvedValue({
      id: questId,
      status: "open",
      title: "Server Quest",
      version: 5,
    })

    const response = await POST(
      request({
        id: mutationId,
        payload: { expectedVersion: 4, questId, title: "Queued title" },
        type: "complete",
        workspaceId,
      }),
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      conflict: { serverQuest: { status: "open", version: 5 } },
      status: "conflict",
    })
  })

  it("revalidates and applies a queued task edit", async () => {
    const payload = {
      description: "Updated offline",
      dueAt: "",
      expectedVersion: 3,
      parentTaskId: "",
      priority: "high",
      projectId: "",
      questId,
      recurrenceRule: "",
      startAt: "",
      title: "Offline edit",
    }
    parseEditQuestForm.mockReturnValue({ data: payload, success: true })
    editQuest.mockResolvedValue({ id: questId, version: 4 })

    const response = await POST(
      request({ id: mutationId, payload, type: "edit", workspaceId }),
    )

    expect(response.status).toBe(200)
    expect(editQuest).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ workspaceId }),
      payload,
    )
  })
})
