import { describe, expect, it } from "vitest"
import { applyOfflineClassifications } from "./classification-overlay"
import type { QuestView } from "@/features/quests/domain/types"
import type { OfflineMutation } from "./types"
import { offlineMutationRequestSchema } from "../validation/offline-mutation-validation"

const quest = {
  id: "task",
  title: "Buy detergent",
  description: "",
  taskType: "personal",
  customType: null,
  typeManual: false,
} as unknown as QuestView

const common = {
  conflict: null,
  createdAt: "2026-09-05T00:00:00Z",
  id: "mutation",
  scopeKey: "scope",
  status: "pending",
  workspaceId: "workspace",
} as const

describe("offline classification", () => {
  it("keeps manual corrections through later offline title edits", () => {
    const mutations: OfflineMutation[] = [
      {
        ...common,
        type: "classify",
        payload: {
          expectedVersion: 1,
          questId: "task",
          title: quest.title,
          taskType: "custom",
          customType: "Shopping",
        },
      },
      {
        ...common,
        type: "edit",
        payload: {
          expectedVersion: 1,
          questId: "task",
          title: "Revise calculus",
          description: "",
          dueAt: "",
          startAt: "",
          priority: "high",
          parentTaskId: "",
          projectId: "",
          recurrenceRule: "",
        },
      },
    ]
    expect(applyOfflineClassifications([quest], mutations)[0]).toMatchObject({
      taskType: "custom",
      customType: "Shopping",
      typeManual: true,
    })
  })

  it("validates queued classifications and rejects empty or invalid choices", () => {
    const request = {
      id: "00000000-0000-4000-8000-000000000001",
      workspaceId: "00000000-0000-4000-8000-000000000002",
      type: "classify",
      payload: {
        expectedVersion: 1,
        questId: "00000000-0000-4000-8000-000000000003",
        title: "Task",
        taskType: "study",
      },
    }
    expect(offlineMutationRequestSchema.safeParse(request).success).toBe(true)
    expect(
      offlineMutationRequestSchema.safeParse({
        ...request,
        payload: { ...request.payload, taskType: "urgent" },
      }).success,
    ).toBe(false)
    expect(
      offlineMutationRequestSchema.safeParse({
        ...request,
        payload: { ...request.payload, taskType: undefined },
      }).success,
    ).toBe(false)
  })
})
