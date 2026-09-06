import "fake-indexeddb/auto"

import { openDB } from "idb"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { GateView } from "@/features/gates/domain/types"
import type { LabelView } from "@/features/labels/domain/types"
import type { QuestView } from "@/features/quests/domain/types"
import type {
  OfflineMutation,
  OfflineScope,
  UserProfileSnapshot,
} from "@/features/offline/domain/types"
import {
  cacheOfflineGates,
  cacheOfflineLabels,
  cacheOfflineProfile,
  cacheOfflineQuests,
  clearPrivateOfflineData,
  enablePrivateOfflineData,
  getOfflineStorageStatus,
  listOfflineMutations,
  lockPrivateOfflineData,
  markOfflineMutationConflict,
  offlineDatabaseName,
  queueOfflineMutation,
  readOfflineFullState,
  readOfflineGates,
  readOfflineLabels,
  readOfflineProfile,
  readOfflineQuestState,
  retryOfflineMutationWithVersion,
  setActiveOfflineScope,
  unlockPrivateOfflineData,
} from "@/features/offline/storage/offline-database"

const scope: OfflineScope = {
  key: "user-a:workspace-a",
  userId: "user-a",
  userName: "Hunter A",
  workspaceId: "workspace-a",
  workspaceName: "Hunter A's Workspace",
}

function quest(overrides: Partial<QuestView> = {}): QuestView {
  return {
    completedAt: null,
    deletedAt: null,
    description: "",
    dueAt: null,
    gateName: null,
    id: "11111111-1111-4111-8111-111111111111",
    labels: [],
    parentTaskId: null,
    position: 0,
    priority: "medium",
    projectId: null,
    recurrenceOccurrenceAt: null,
    recurrenceRule: null,
    recurrenceSequence: null,
    recurrenceSeriesId: null,
    recurrenceTimezone: null,
    startAt: null,
    status: "open",
    subquestCount: 0,
    title: "Cached Quest",
    version: 3,
    ...overrides,
  }
}

afterEach(async () => {
  await clearPrivateOfflineData()
})

beforeEach(async () => {
  await enablePrivateOfflineData("offline-passcode")
  await setActiveOfflineScope(scope)
})

describe("private offline IndexedDB", () => {
  it("combines a bounded snapshot with queued creations and completions", async () => {
    await cacheOfflineQuests(scope, [quest()])
    const createMutation: OfflineMutation = {
      conflict: null,
      createdAt: "2026-08-09T10:00:00.000Z",
      id: "22222222-2222-4222-8222-222222222222",
      optimisticQuest: quest({
        id: "offline-22222222-2222-4222-8222-222222222222",
        title: "Queued Quest",
        version: 1,
      }),
      payload: {
        description: "",
        dueAt: "",
        parentTaskId: "",
        priority: "medium",
        projectId: "",
        recurrenceRule: "",
        startAt: "",
        title: "Queued Quest",
      },
      scopeKey: scope.key,
      status: "pending",
      type: "create",
      workspaceId: scope.workspaceId,
    }
    const completeMutation: OfflineMutation = {
      conflict: null,
      createdAt: "2026-08-09T10:01:00.000Z",
      id: "33333333-3333-4333-8333-333333333333",
      payload: {
        expectedVersion: 3,
        questId: "11111111-1111-4111-8111-111111111111",
        title: "Cached Quest",
      },
      scopeKey: scope.key,
      status: "pending",
      type: "complete",
      workspaceId: scope.workspaceId,
    }

    await queueOfflineMutation(createMutation)
    await queueOfflineMutation(completeMutation)

    const state = await readOfflineQuestState()
    expect(state?.pendingCount).toBe(2)
    expect(state?.quests.map(({ title }) => title)).toEqual(["Queued Quest"])
  })

  it("retains conflicts until the user accepts or retries a server version", async () => {
    await setActiveOfflineScope(scope)
    const mutation: OfflineMutation = {
      conflict: null,
      createdAt: "2026-08-09T10:01:00.000Z",
      id: "33333333-3333-4333-8333-333333333333",
      payload: {
        expectedVersion: 3,
        questId: "11111111-1111-4111-8111-111111111111",
        title: "Cached Quest",
      },
      scopeKey: scope.key,
      status: "pending",
      type: "complete",
      workspaceId: scope.workspaceId,
    }
    await queueOfflineMutation(mutation)
    await markOfflineMutationConflict(mutation.id, {
      message: "Server changed.",
      serverQuest: {
        id: mutation.payload.questId,
        status: "open",
        title: mutation.payload.title,
        version: 4,
      },
    })

    expect((await readOfflineQuestState())?.conflicts).toHaveLength(1)
    await retryOfflineMutationWithVersion(mutation.id, 4)
    const [retried] = await listOfflineMutations(scope.key)
    expect(retried?.status).toBe("pending")
    expect(
      retried?.type === "complete" && retried.payload.expectedVersion,
    ).toBe(4)
  })

  it("applies queued edits and deletions to the private offline snapshot", async () => {
    const cached = quest()
    await cacheOfflineQuests(scope, [cached])
    await queueOfflineMutation({
      conflict: null,
      createdAt: "2026-08-09T10:01:00.000Z",
      id: "44444444-4444-4444-8444-444444444444",
      payload: {
        description: "Edited while offline",
        dueAt: "",
        expectedVersion: cached.version,
        parentTaskId: "",
        priority: "high",
        projectId: "",
        questId: cached.id,
        recurrenceRule: "",
        startAt: "",
        title: "Updated offline",
      },
      scopeKey: scope.key,
      status: "pending",
      type: "edit",
      workspaceId: scope.workspaceId,
    })

    expect((await readOfflineQuestState())?.quests[0]).toMatchObject({
      description: "Edited while offline",
      priority: "high",
      title: "Updated offline",
    })

    await queueOfflineMutation({
      conflict: null,
      createdAt: "2026-08-09T10:02:00.000Z",
      id: "55555555-5555-4555-8555-555555555555",
      payload: {
        expectedVersion: cached.version,
        questId: cached.id,
        title: cached.title,
      },
      scopeKey: scope.key,
      status: "pending",
      type: "delete",
      workspaceId: scope.workspaceId,
    })
    expect((await readOfflineQuestState())?.quests).toEqual([])
  })

  it("prunes another identity's private snapshot when the active user changes", async () => {
    await cacheOfflineQuests(scope, [quest()])
    await setActiveOfflineScope({
      ...scope,
      key: "user-b:workspace-b",
      userId: "user-b",
      workspaceId: "workspace-b",
      workspaceName: "Hunter B's Workspace",
    })

    const state = await readOfflineQuestState()
    expect(state).toBeNull()
    expect((await getOfflineStorageStatus()).enabled).toBe(false)
  })

  it("deletes all private data during logout", async () => {
    await cacheOfflineQuests(scope, [quest()])
    await clearPrivateOfflineData()
    expect(await readOfflineQuestState()).toBeNull()
  })

  it("requires the local passcode after the offline store is locked", async () => {
    await cacheOfflineQuests(scope, [quest()])
    lockPrivateOfflineData()

    await expect(readOfflineQuestState()).rejects.toThrow("locked")
    await expect(unlockPrivateOfflineData("wrong-passcode")).resolves.toBe(
      false,
    )
    await expect(unlockPrivateOfflineData("offline-passcode")).resolves.toBe(
      true,
    )
    expect((await readOfflineQuestState())?.quests[0]?.title).toBe(
      "Cached Quest",
    )
  })

  it("expires stale snapshots", async () => {
    const savedAt = new Date("2026-01-01T00:00:00.000Z")
    await cacheOfflineQuests(scope, [quest()], savedAt)

    const state = await readOfflineQuestState(
      new Date("2026-01-09T00:00:00.000Z"),
    )
    expect(state?.quests).toEqual([])
    expect(state?.updatedAt).toBeNull()
  })

  it("stores task content as ciphertext instead of plaintext", async () => {
    await cacheOfflineQuests(scope, [quest({ title: "Highly private task" })])
    const raw = await openDB(offlineDatabaseName)
    const records = await raw.getAll("snapshots")
    raw.close()

    expect(JSON.stringify(records)).not.toContain("Highly private task")
    expect(JSON.stringify(records)).toContain("ciphertext")
  })

  it("does not persist task data before explicit opt-in", async () => {
    await clearPrivateOfflineData()
    await cacheOfflineQuests(scope, [quest()])

    expect(await readOfflineQuestState()).toBeNull()
    expect((await getOfflineStorageStatus()).enabled).toBe(false)
  })

  it("caches and reads gates, labels, and user profile with full offline autonomy", async () => {
    const testGates: readonly GateView[] = [
      {
        accentToken: "system-blue",
        archivedAt: null,
        description: "Core project roadmap",
        id: "gate-1",
        name: "Project Titan",
        position: 0,
        questCount: 12,
        version: 1,
      },
      {
        accentToken: "mana-violet",
        archivedAt: "2026-08-01T00:00:00.000Z",
        description: "Old archives",
        id: "gate-2",
        name: "Legacy Work",
        position: 1,
        questCount: 4,
        version: 2,
      },
    ]

    const testLabels: readonly LabelView[] = [
      {
        colorToken: "status-danger",
        id: "label-1",
        name: "Urgent",
        version: 1,
      },
      {
        colorToken: "spectral-cyan",
        id: "label-2",
        name: "Frontend",
        version: 1,
      },
    ]

    const testProfile: UserProfileSnapshot = {
      avatarUrl: "https://example.com/avatar.png",
      timezone: "Asia/Kolkata",
      userId: scope.userId,
      userName: scope.userName,
      workspaceId: scope.workspaceId,
      workspaceName: scope.workspaceName,
    }

    await cacheOfflineQuests(scope, [quest({ title: "Autonomous task" })])
    await cacheOfflineGates(scope, testGates)
    await cacheOfflineLabels(scope, testLabels)
    await cacheOfflineProfile(scope, testProfile)

    // Direct readers
    const readGates = await readOfflineGates()
    expect(readGates).toHaveLength(2)
    expect(readGates[0]?.name).toBe("Project Titan")
    expect(readGates[0]?.accentToken).toBe("system-blue")

    const readLabels = await readOfflineLabels()
    expect(readLabels).toHaveLength(2)
    expect(readLabels[0]?.name).toBe("Urgent")
    expect(readLabels[0]?.colorToken).toBe("status-danger")

    const readProfile = await readOfflineProfile()
    expect(readProfile?.userName).toBe("Hunter A")
    expect(readProfile?.timezone).toBe("Asia/Kolkata")

    // Full state reader
    const fullState = await readOfflineFullState()
    expect(fullState).not.toBeNull()
    expect(fullState?.quests[0]?.title).toBe("Autonomous task")
    expect(fullState?.gates).toHaveLength(2)
    expect(fullState?.labels).toHaveLength(2)
    expect(fullState?.profile?.workspaceName).toBe("Hunter A's Workspace")
  })

  it("encrypts gates, labels, and user profile as ciphertext in IndexedDB", async () => {
    await cacheOfflineGates(scope, [
      {
        accentToken: "spectral-cyan",
        archivedAt: null,
        description: "Confidential gate description",
        id: "g-private",
        name: "Secret Operation",
        position: 0,
        questCount: 1,
        version: 1,
      },
    ])
    await cacheOfflineLabels(scope, [
      {
        colorToken: "status-warning",
        id: "l-private",
        name: "ConfidentialTag",
        version: 1,
      },
    ])

    const raw = await openDB(offlineDatabaseName)
    const gateRecords = await raw.getAll("gatesSnapshot")
    const labelRecords = await raw.getAll("labelsSnapshot")
    raw.close()

    expect(JSON.stringify(gateRecords)).not.toContain("Secret Operation")
    expect(JSON.stringify(gateRecords)).toContain("ciphertext")
    expect(JSON.stringify(labelRecords)).not.toContain("ConfidentialTag")
    expect(JSON.stringify(labelRecords)).toContain("ciphertext")
  })

  it("expires stale gates, labels, and profile snapshots after lifetime limit", async () => {
    const savedAt = new Date("2026-01-01T00:00:00.000Z")
    await cacheOfflineGates(
      scope,
      [
        {
          accentToken: "system-blue",
          archivedAt: null,
          description: "",
          id: "g-old",
          name: "Old Gate",
          position: 0,
          questCount: 0,
          version: 1,
        },
      ],
      savedAt,
    )
    await cacheOfflineLabels(
      scope,
      [
        {
          colorToken: "mana-violet",
          id: "l-old",
          name: "Old Label",
          version: 1,
        },
      ],
      savedAt,
    )
    await cacheOfflineProfile(
      scope,
      {
        timezone: "UTC",
        userId: scope.userId,
        userName: scope.userName,
        workspaceId: scope.workspaceId,
        workspaceName: scope.workspaceName,
      },
      savedAt,
    )

    const future = new Date("2026-01-09T00:00:00.000Z")
    expect(await readOfflineGates(future)).toEqual([])
    expect(await readOfflineLabels(future)).toEqual([])
    expect(await readOfflineProfile(future)).toBeNull()
  })
})
