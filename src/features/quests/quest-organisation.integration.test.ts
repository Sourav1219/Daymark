// @vitest-environment node

import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { createDatabase, type Database } from "@/db/client"
import {
  gates,
  labels,
  questLabels,
  tasks,
  users,
  workspaces,
} from "@/db/schema"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { createGate } from "@/features/gates/mutations/gate-mutation-service"
import { createGateSchema } from "@/features/gates/validation/gate-validation"
import {
  completeQuest,
  createQuest,
  editQuest,
} from "@/features/quests/mutations/quest-mutation-service"
import { getQuestList } from "@/features/quests/queries/quest-query-service"
import {
  createQuestSchema,
  editQuestSchema,
} from "@/features/quests/validation/quest-validation"
import { provisionPersonalWorkspace } from "@/features/workspaces/application/provision-personal-workspace"
import { findWorkspaceAccess } from "@/features/workspaces/infrastructure/workspace-access-repository"
import { clearReminderFixtures } from "@/test/clear-reminder-fixtures"

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const integrationDescribe = testDatabaseUrl
  ? describe.sequential
  : describe.skip

type Fixture = Readonly<{
  first: AccessContext
  second: AccessContext
}>

async function seedFixture(database: Database): Promise<Fixture> {
  const firstUserId = randomUUID()
  const secondUserId = randomUUID()
  await database.insert(users).values([
    {
      email: `org-first-${firstUserId}@example.com`,
      id: firstUserId,
      name: "First Organisation User",
    },
    {
      email: `org-second-${secondUserId}@example.com`,
      id: secondUserId,
      name: "Second Organisation User",
    },
  ])
  const firstWorkspaceId = await provisionPersonalWorkspace(database, {
    id: firstUserId,
    name: "First Organisation User",
  })
  const secondWorkspaceId = await provisionPersonalWorkspace(database, {
    id: secondUserId,
    name: "Second Organisation User",
  })
  const [first, second] = await Promise.all([
    findWorkspaceAccess(database, {
      userId: firstUserId,
      workspaceId: firstWorkspaceId,
    }),
    findWorkspaceAccess(database, {
      userId: secondUserId,
      workspaceId: secondWorkspaceId,
    }),
  ])

  if (!first || !second) {
    throw new Error("Expected seeded workspace access")
  }

  return { first, second }
}

function questCommand(overrides: Readonly<Record<string, unknown>> = {}) {
  return createQuestSchema.parse({
    description: "A repository-backed Quest.",
    dueAt: "2026-08-08T13:00",
    priority: "high",
    startAt: "2026-08-08T09:00",
    title: "Organisation Quest",
    ...overrides,
  })
}

function editCommand(
  questId: string,
  expectedVersion: number,
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return editQuestSchema.parse({
    description: "A repository-backed Quest.",
    dueAt: "2026-08-08T13:00",
    expectedVersion,
    priority: "high",
    questId,
    startAt: "2026-08-08T09:00",
    title: "Organisation Quest",
    ...overrides,
  })
}

integrationDescribe(
  "Quest Subquests, Gate assignment, and filtered listing",
  () => {
    let database: Database
    let fixture: Fixture

    beforeAll(() => {
      if (!testDatabaseUrl) {
        throw new Error("TEST_DATABASE_URL is required for integration tests")
      }

      database = createDatabase(testDatabaseUrl)
    })

    beforeEach(async () => {
      await clearReminderFixtures(database)
      await database.delete(questLabels)
      await database.delete(tasks)
      await database.delete(labels)
      await database.delete(gates)
      await database.delete(workspaces)
      await database.delete(users)
      fixture = await seedFixture(database)
    })

    afterAll(async () => {
      if (database) {
        await database.$client.end({ timeout: 2 })
      }
    })

    it("nests Subquests within the deliberate depth limit", async () => {
      const root = await createQuest(
        database,
        fixture.first,
        questCommand({ title: "Root Quest" }),
      )
      const child = await createQuest(
        database,
        fixture.first,
        questCommand({ parentTaskId: root.id, title: "Child Subquest" }),
      )
      const grandchild = await createQuest(
        database,
        fixture.first,
        questCommand({
          parentTaskId: child.id,
          title: "Grandchild Subquest",
        }),
      )

      // The third nesting level is refused.
      await expect(
        createQuest(
          database,
          fixture.first,
          questCommand({
            parentTaskId: grandchild.id,
            title: "Too Deep Subquest",
          }),
        ),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" })

      // A Quest cannot become its own Subquest.
      await expect(
        editQuest(
          database,
          fixture.first,
          editCommand(root.id, root.version, { parentTaskId: root.id }),
        ),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" })

      // Parents from other workspaces are invisible.
      await expect(
        createQuest(
          database,
          fixture.first,
          questCommand({ parentTaskId: randomUUID() }),
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" })

      const active = await getQuestList(fixture.first, "active", {
        database,
      })
      expect(active).toHaveLength(3)
      const rootView = active.find((quest) => quest.id === root.id)
      const childView = active.find((quest) => quest.id === child.id)
      expect(rootView).toMatchObject({
        parentTaskId: null,
        subquestCount: 1,
      })
      expect(childView).toMatchObject({
        parentTaskId: root.id,
        subquestCount: 1,
      })
    })

    it("prevents parent cycles when reassigning Subquests", async () => {
      const root = await createQuest(
        database,
        fixture.first,
        questCommand({ title: "Root Quest" }),
      )
      const child = await createQuest(
        database,
        fixture.first,
        questCommand({ parentTaskId: root.id, title: "Child Subquest" }),
      )

      await expect(
        editQuest(
          database,
          fixture.first,
          editCommand(root.id, root.version, { parentTaskId: child.id }),
        ),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" })

      // The failed edit must not have persisted.
      const [persisted] = await getQuestList(fixture.first, "active", {
        database,
        filters: { search: "Root Quest" },
      })
      expect(persisted).toMatchObject({ parentTaskId: null, version: 1 })
    })

    it("serializes concurrent parent edits so they cannot create a cycle", async () => {
      const first = await createQuest(
        database,
        fixture.first,
        questCommand({ title: "Concurrent First" }),
      )
      const second = await createQuest(
        database,
        fixture.first,
        questCommand({ title: "Concurrent Second" }),
      )
      const outcomes = await Promise.allSettled([
        editQuest(
          database,
          fixture.first,
          editCommand(first.id, first.version, {
            parentTaskId: second.id,
            title: "Concurrent First",
          }),
        ),
        editQuest(
          database,
          fixture.first,
          editCommand(second.id, second.version, {
            parentTaskId: first.id,
            title: "Concurrent Second",
          }),
        ),
      ])

      expect(
        outcomes.filter((outcome) => outcome.status === "fulfilled"),
      ).toHaveLength(1)

      const persisted = await getQuestList(fixture.first, "active", {
        database,
      })
      const firstView = persisted.find((quest) => quest.id === first.id)
      const secondView = persisted.find((quest) => quest.id === second.id)
      expect(
        firstView?.parentTaskId === second.id &&
          secondView?.parentTaskId === first.id,
      ).toBe(false)
    })

    it("enforces workspace relationships in PostgreSQL constraints", async () => {
      const foreignGate = await createGate(
        database,
        fixture.second,
        createGateSchema.parse({
          accentToken: "system-blue",
          description: "",
          name: "Foreign Constraint Gate",
        }),
      )

      await expect(
        database.insert(tasks).values({
          createdByUserId: fixture.first.userId,
          projectId: foreignGate.id,
          title: "Invalid cross-workspace Quest",
          workspaceId: fixture.first.workspaceId,
        }),
      ).rejects.toMatchObject({
        cause: {
          code: "23503",
          constraint_name: "tasks_project_workspace_fk",
        },
      })

      const foreignParent = await createQuest(
        database,
        fixture.second,
        questCommand({ title: "Foreign Constraint Parent" }),
      )
      await expect(
        database.insert(tasks).values({
          createdByUserId: fixture.first.userId,
          parentTaskId: foreignParent.id,
          title: "Invalid cross-workspace Subquest",
          workspaceId: fixture.first.workspaceId,
        }),
      ).rejects.toMatchObject({
        cause: {
          code: "23503",
          constraint_name: "tasks_parent_workspace_fk",
        },
      })

      const localQuest = await createQuest(
        database,
        fixture.first,
        questCommand({ title: "Local Constraint Quest" }),
      )
      const [foreignLabel] = await database
        .insert(labels)
        .values({
          createdByUserId: fixture.second.userId,
          name: "Foreign Constraint Label",
          workspaceId: fixture.second.workspaceId,
        })
        .returning({ id: labels.id })

      await expect(
        database.insert(questLabels).values({
          createdByUserId: fixture.first.userId,
          labelId: foreignLabel?.id ?? randomUUID(),
          questId: localQuest.id,
          workspaceId: fixture.first.workspaceId,
        }),
      ).rejects.toMatchObject({
        cause: {
          code: "23503",
          constraint_name: "quest_labels_label_workspace_fk",
        },
      })
    })

    it("assigns Quests to Gates and exposes Gate filtering", async () => {
      const gate = await createGate(
        database,
        fixture.first,
        createGateSchema.parse({
          accentToken: "system-blue",
          description: "",
          name: "Campaign Gate",
        }),
      )
      const gated = await createQuest(
        database,
        fixture.first,
        questCommand({ projectId: gate.id, title: "Gated Quest" }),
      )
      await createQuest(
        database,
        fixture.first,
        questCommand({ title: "Ungated Quest" }),
      )

      const active = await getQuestList(fixture.first, "active", { database })
      expect(active.find((quest) => quest.id === gated.id)).toMatchObject({
        gateName: "Campaign Gate",
        projectId: gate.id,
      })

      await expect(
        getQuestList(fixture.first, "active", {
          database,
          filters: { gateId: gate.id },
        }),
      ).resolves.toHaveLength(1)
      await expect(
        getQuestList(fixture.first, "active", {
          database,
          filters: { gateId: "none" },
        }),
      ).resolves.toHaveLength(1)

      // Filtering by another workspace's Gate id returns nothing.
      await expect(
        getQuestList(fixture.second, "active", {
          database,
          filters: { gateId: gate.id },
        }),
      ).resolves.toHaveLength(0)
    })

    it("searches, filters, and sorts Quests server-side", async () => {
      const now = new Date("2026-08-08T12:00:00.000Z")
      const early = await createQuest(
        database,
        fixture.first,
        questCommand({
          dueAt: "2026-08-07T12:00",
          priority: "low",
          startAt: "",
          title: "Forge the Blade",
        }),
      )
      await createQuest(
        database,
        fixture.first,
        questCommand({
          dueAt: "2026-08-10T12:00",
          priority: "critical",
          title: "Sharpen the Blade",
        }),
      )
      await createQuest(
        database,
        fixture.first,
        questCommand({
          dueAt: "",
          priority: "medium",
          title: "Special_Quest",
        }),
      )

      // Search matches title text; wildcard characters are treated literally.
      const result = await getQuestList(fixture.first, "active", {
        database,
        filters: { search: "blade" },
      })
      expect(result).toHaveLength(2)
      await expect(
        getQuestList(fixture.first, "active", {
          database,
          filters: { search: "_" },
        }),
      ).resolves.toMatchObject([{ title: "Special_Quest" }])

      // Priority and status filters.
      await expect(
        getQuestList(fixture.first, "active", {
          database,
          filters: { priority: "critical" },
        }),
      ).resolves.toMatchObject([{ title: "Sharpen the Blade" }])
      await completeQuest(
        database,
        fixture.first,
        { expectedVersion: early.version, questId: early.id },
        now,
      )
      await expect(
        getQuestList(fixture.first, "active", {
          database,
          filters: { status: "completed" },
        }),
      ).resolves.toMatchObject([{ title: "Forge the Blade" }])
      await expect(
        getQuestList(fixture.first, "active", {
          database,
          filters: { status: "all" },
        }),
      ).resolves.toHaveLength(3)

      // Due-date filters.
      await expect(
        getQuestList(fixture.first, "active", {
          database,
          filters: { due: "overdue" },
          now,
        }),
      ).resolves.toHaveLength(0)
      await expect(
        getQuestList(fixture.first, "active", {
          database,
          filters: { due: "upcoming" },
          now,
        }),
      ).resolves.toMatchObject([{ title: "Sharpen the Blade" }])
      await expect(
        getQuestList(fixture.first, "active", {
          database,
          filters: { due: "none" },
        }),
      ).resolves.toMatchObject([{ title: "Special_Quest" }])

      // Sort options run in the database.
      const byDue = await getQuestList(fixture.first, "active", {
        database,
        filters: { sort: "due-soonest" },
      })
      expect(byDue.map((quest) => quest.title)).toEqual([
        "Sharpen the Blade",
        "Special_Quest",
      ])
      const byPriority = await getQuestList(fixture.first, "active", {
        database,
        filters: { sort: "priority" },
      })
      expect(byPriority[0]?.title).toBe("Sharpen the Blade")
    })

    it("bounds performance-sensitive list queries", async () => {
      await Promise.all([
        createQuest(
          database,
          fixture.first,
          questCommand({ title: "Bounded Quest One" }),
        ),
        createQuest(
          database,
          fixture.first,
          questCommand({ title: "Bounded Quest Two" }),
        ),
        createQuest(
          database,
          fixture.first,
          questCommand({ title: "Bounded Quest Three" }),
        ),
      ])

      await expect(
        getQuestList(fixture.first, "active", { database, limit: 2 }),
      ).resolves.toHaveLength(2)
    })
  },
)
