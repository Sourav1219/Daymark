// @vitest-environment node

import { randomUUID } from "node:crypto"

import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { createDatabase, type Database } from "@/db/client"
import {
  activityEvents,
  gates,
  labels,
  questLabels,
  tasks,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import {
  completeQuest,
  createQuest,
  editQuest,
  failOverdueQuests,
  permanentlyDeleteQuest,
  reopenQuest,
  reorderQuests,
  restoreQuest,
  restoreQuestWithSchedule,
  softDeleteQuest,
} from "@/features/quests/mutations/quest-mutation-service"
import { getDailyXpSummary } from "@/features/progression/queries/progression-query-service"
import {
  getQuestList,
  getQuestRecoveryBoard,
} from "@/features/quests/queries/quest-query-service"
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
      email: `quest-first-${firstUserId}@example.com`,
      id: firstUserId,
      name: "First Quest User",
    },
    {
      email: `quest-second-${secondUserId}@example.com`,
      id: secondUserId,
      name: "Second Quest User",
    },
  ])
  const firstWorkspaceId = await provisionPersonalWorkspace(database, {
    id: firstUserId,
    name: "First Quest User",
  })
  const secondWorkspaceId = await provisionPersonalWorkspace(database, {
    id: secondUserId,
    name: "Second Quest User",
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
    title: "Integration Quest",
    ...overrides,
  })
}

integrationDescribe("Quest repository and application services", () => {
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

  it("runs create, read, edit, complete, reopen, delete, and restore", async () => {
    const created = await createQuest(database, fixture.first, questCommand())
    expect(created.version).toBe(1)

    let active = await getQuestList(fixture.first, "active", { database })
    expect(active).toHaveLength(1)
    expect(active[0]).toMatchObject({
      id: created.id,
      priority: "high",
      status: "open",
      title: "Integration Quest",
    })

    const edited = await editQuest(
      database,
      fixture.first,
      editQuestSchema.parse({
        description: "Updated safely.",
        dueAt: "2026-08-08T14:00",
        expectedVersion: created.version,
        priority: "critical",
        questId: created.id,
        startAt: "2026-08-08T10:00",
        title: "Edited Integration Quest",
      }),
    )
    expect(edited.version).toBe(2)

    const completed = await completeQuest(
      database,
      fixture.first,
      { expectedVersion: edited.version, questId: edited.id },
      new Date("2026-08-08T12:00:00.000Z"),
    )
    expect(completed.version).toBe(3)
    await expect(
      getQuestList(fixture.first, "active", { database }),
    ).resolves.toHaveLength(0)
    await expect(
      getQuestList(fixture.first, "cleared", { database }),
    ).resolves.toMatchObject([
      {
        completedAt: "2026-08-08T12:00:00.000Z",
        status: "completed",
        title: "Edited Integration Quest",
      },
    ])

    const reopened = await reopenQuest(database, fixture.first, {
      expectedVersion: completed.version,
      questId: completed.id,
    })
    expect(reopened.version).toBe(4)

    const deleted = await softDeleteQuest(
      database,
      fixture.first,
      { expectedVersion: reopened.version, questId: reopened.id },
      new Date("2026-08-08T15:00:00.000Z"),
    )
    expect(deleted.version).toBe(5)

    const recovery = await getQuestRecoveryBoard(fixture.first, {
      database,
      now: new Date("2026-08-08T15:30:00.000Z"),
    })
    expect(recovery.active).toHaveLength(0)
    expect(recovery.deleted).toMatchObject([
      { id: created.id, title: "Edited Integration Quest", version: 5 },
    ])

    const restored = await restoreQuest(
      database,
      fixture.first,
      {
        expectedVersion: deleted.version,
        questId: deleted.id,
      },
      new Date("2026-08-08T16:00:00.000Z"),
    )
    expect(restored.version).toBe(6)
    active = await getQuestList(fixture.first, "active", { database })
    expect(active).toMatchObject([
      { deletedAt: null, id: created.id, status: "open", version: 6 },
    ])
  })

  it("permanently removes a trashed task from product views", async () => {
    const created = await createQuest(
      database,
      fixture.first,
      questCommand({ title: "Delete forever" }),
    )
    const deleted = await softDeleteQuest(
      database,
      fixture.first,
      { expectedVersion: created.version, questId: created.id },
      new Date("2026-08-08T15:00:00.000Z"),
    )

    await expect(
      permanentlyDeleteQuest(
        database,
        fixture.second,
        { expectedVersion: deleted.version, questId: deleted.id },
        new Date("2026-08-08T15:10:00.000Z"),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })

    const purged = await permanentlyDeleteQuest(
      database,
      fixture.first,
      { expectedVersion: deleted.version, questId: deleted.id },
      new Date("2026-08-08T15:10:00.000Z"),
    )
    expect(purged).toMatchObject({ id: created.id, version: 3 })
    await expect(
      getQuestList(fixture.first, "deleted", { database }),
    ).resolves.toHaveLength(0)
    await expect(
      restoreQuest(database, fixture.first, {
        expectedVersion: purged.version,
        questId: purged.id,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })

    await expect(
      database
        .select({ purgedAt: tasks.purgedAt })
        .from(tasks)
        .where(
          and(
            eq(tasks.id, purged.id),
            eq(tasks.workspaceId, fixture.first.workspaceId),
          ),
        ),
    ).resolves.toMatchObject([{ purgedAt: expect.any(Date) }])
  })

  it("expires Trash recovery at the end of the local day", async () => {
    const created = await createQuest(
      database,
      fixture.first,
      questCommand({ title: "Expired recovery task" }),
    )
    const deleted = await softDeleteQuest(
      database,
      fixture.first,
      { expectedVersion: created.version, questId: created.id },
      new Date("2026-08-08T17:30:00.000Z"),
    )

    await expect(
      getQuestList(fixture.first, "deleted", {
        database,
        now: new Date("2026-08-08T18:00:00.000Z"),
      }),
    ).resolves.toMatchObject([{ id: deleted.id }])
    await expect(
      getQuestList(fixture.first, "deleted", {
        database,
        now: new Date("2026-08-09T01:00:00.000Z"),
      }),
    ).resolves.toMatchObject([{ id: deleted.id }])
    await expect(
      restoreQuest(
        database,
        fixture.first,
        { expectedVersion: deleted.version, questId: deleted.id },
        new Date("2026-08-09T01:00:00.000Z"),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" })

    await expect(
      database
        .select({ eventType: activityEvents.eventType })
        .from(activityEvents)
        .where(eq(activityEvents.subjectId, deleted.id)),
    ).resolves.toEqual(expect.arrayContaining([{ eventType: "quest_deleted" }]))
  })

  it("denies cross-workspace reads, writes, and fabricated contexts", async () => {
    const created = await createQuest(database, fixture.first, questCommand())

    await expect(
      getQuestList(fixture.second, "active", { database }),
    ).resolves.toHaveLength(0)
    await expect(
      editQuest(
        database,
        fixture.second,
        editQuestSchema.parse({
          ...questCommand(),
          expectedVersion: created.version,
          questId: created.id,
          title: "Cross-workspace overwrite",
        }),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })

    const fabricated = {
      ...fixture.first,
      userId: fixture.second.userId,
    }
    await expect(
      createQuest(database, fabricated, questCommand()),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })

    const persisted = await getQuestList(fixture.first, "active", { database })
    expect(persisted[0]?.title).toBe("Integration Quest")
  })

  it("blocks access after membership or workspace soft deletion", async () => {
    await createQuest(database, fixture.first, questCommand())
    await database
      .update(workspaceMembers)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(workspaceMembers.userId, fixture.first.userId),
          eq(workspaceMembers.workspaceId, fixture.first.workspaceId),
        ),
      )

    await expect(
      getQuestList(fixture.first, "active", { database }),
    ).resolves.toHaveLength(0)
    await expect(
      createQuest(database, fixture.first, questCommand()),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })

    await database
      .update(workspaceMembers)
      .set({ deletedAt: null })
      .where(eq(workspaceMembers.workspaceId, fixture.first.workspaceId))
    await database
      .update(workspaces)
      .set({ deletedAt: new Date() })
      .where(eq(workspaces.id, fixture.first.workspaceId))

    await expect(
      getQuestList(fixture.first, "active", { database }),
    ).resolves.toHaveLength(0)
  })

  it("detects stale optimistic-concurrency versions without overwriting", async () => {
    const created = await createQuest(database, fixture.first, questCommand())
    await editQuest(
      database,
      fixture.first,
      editQuestSchema.parse({
        ...questCommand(),
        expectedVersion: created.version,
        questId: created.id,
        title: "Winning update",
      }),
    )

    await expect(
      editQuest(
        database,
        fixture.first,
        editQuestSchema.parse({
          ...questCommand(),
          expectedVersion: created.version,
          questId: created.id,
          title: "Stale update",
        }),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" })

    const [persisted] = await getQuestList(fixture.first, "active", {
      database,
    })
    expect(persisted).toMatchObject({ title: "Winning update", version: 2 })
  })

  it("replays offline create and completion idempotently while preserving conflicts", async () => {
    const createMutationId = randomUUID()
    const first = await createQuest(
      database,
      fixture.first,
      questCommand({ title: "Offline replay Quest" }),
      createMutationId,
    )
    const replayedCreate = await createQuest(
      database,
      fixture.first,
      questCommand({ title: "Offline replay Quest" }),
      createMutationId,
    )
    expect(replayedCreate).toEqual(first)
    await expect(
      getQuestList(fixture.first, "active", { database }),
    ).resolves.toHaveLength(1)

    const completionMutationId = randomUUID()
    const completed = await completeQuest(
      database,
      fixture.first,
      { expectedVersion: first.version, questId: first.id },
      new Date("2026-08-09T12:00:00.000Z"),
      completionMutationId,
    )
    const replayedCompletion = await completeQuest(
      database,
      fixture.first,
      { expectedVersion: first.version, questId: first.id },
      new Date("2026-08-09T12:00:00.000Z"),
      completionMutationId,
    )
    expect(replayedCompletion).toEqual(completed)

    await expect(
      completeQuest(
        database,
        fixture.first,
        { expectedVersion: first.version, questId: first.id },
        new Date("2026-08-09T12:00:00.000Z"),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("persists ordering transactionally and rolls back stale versions", async () => {
    const created = []

    for (const title of ["First Quest", "Second Quest", "Third Quest"]) {
      created.push(
        await createQuest(database, fixture.first, questCommand({ title })),
      )
    }

    expect(
      (await getQuestList(fixture.first, "active", { database })).map(
        ({ position, title }) => ({ position, title }),
      ),
    ).toEqual([
      { position: 0, title: "First Quest" },
      { position: 1, title: "Second Quest" },
      { position: 2, title: "Third Quest" },
    ])

    const reversed = [...created].reverse()
    const reordered = await reorderQuests(database, fixture.first, {
      quests: reversed.map(({ id, version }) => ({
        expectedVersion: version,
        questId: id,
      })),
    })
    expect(reordered.quests.map(({ id }) => id)).toEqual(
      reversed.map(({ id }) => id),
    )
    expect(
      (await getQuestList(fixture.first, "active", { database })).map(
        ({ title }) => title,
      ),
    ).toEqual(["Third Quest", "Second Quest", "First Quest"])

    const second = reordered.quests[1]
    if (!second) {
      throw new Error("Expected reordered Quest")
    }
    await editQuest(
      database,
      fixture.first,
      editQuestSchema.parse({
        ...questCommand(),
        expectedVersion: second.version,
        questId: second.id,
        title: "Second Quest updated elsewhere",
      }),
    )

    await expect(
      reorderQuests(database, fixture.first, {
        quests: [...reordered.quests].reverse().map(({ id, version }) => ({
          expectedVersion: version,
          questId: id,
        })),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" })
    expect(
      (await getQuestList(fixture.first, "active", { database })).map(
        ({ title }) => title,
      ),
    ).toEqual(["Third Quest", "Second Quest updated elsewhere", "First Quest"])
  })

  it("scopes the daily view to the selected calendar date", async () => {
    await Promise.all([
      createQuest(
        database,
        fixture.first,
        questCommand({
          dueAt: "2026-08-07T12:00",
          startAt: "",
          title: "Overdue Quest",
        }),
      ),
      createQuest(
        database,
        fixture.first,
        questCommand({
          dueAt: "2026-08-08T16:00",
          startAt: "",
          title: "Due Today Quest",
        }),
      ),
      createQuest(
        database,
        fixture.first,
        questCommand({
          dueAt: "2026-08-09T12:00",
          startAt: "",
          title: "Future Quest",
        }),
      ),
      createQuest(
        database,
        fixture.first,
        questCommand({
          dueAt: "",
          startAt: "",
          title: "Unscheduled Quest",
        }),
      ),
    ])

    const today = await getQuestList(fixture.first, "today", {
      database,
      now: new Date("2026-08-08T12:00:00.000Z"),
    })
    expect(today.map((quest) => quest.title).sort()).toEqual([
      "Due Today Quest",
      "Unscheduled Quest",
    ])

    const nextDay = await getQuestList(fixture.first, "today", {
      database,
      localDate: "2026-08-09",
      now: new Date("2026-08-08T12:00:00.000Z"),
    })
    expect(nextDay.map((quest) => quest.title)).toEqual(["Future Quest"])
  })

  it("persists completed, missed, and daily points history", async () => {
    const completed = await createQuest(
      database,
      fixture.first,
      questCommand({
        dueAt: "2026-08-09T17:00",
        startAt: "2026-08-09T09:00",
        title: "Completed on selected day",
      }),
    )
    const missed = await createQuest(
      database,
      fixture.first,
      questCommand({
        dueAt: "2026-08-08T16:00",
        startAt: "2026-08-08T15:00",
        title: "Missed on selected day",
      }),
    )
    const activityTime = new Date("2026-08-08T18:00:00.000Z")

    await completeQuest(
      database,
      fixture.first,
      { expectedVersion: completed.version, questId: completed.id },
      activityTime,
    )
    await failOverdueQuests(database, fixture.first, activityTime)

    const history = await getQuestList(fixture.first, "today", {
      database,
      localDate: "2026-08-08",
      now: activityTime,
    })
    expect(history).toMatchObject([
      { status: "completed", title: "Completed on selected day" },
      { status: "failed", title: "Missed on selected day" },
    ])

    const failed = history.find(({ id }) => id === missed.id)
    expect(failed).toBeDefined()
    await expect(
      getQuestList(fixture.first, "today", {
        database,
        localDate: "2026-08-09",
        now: new Date("2026-08-09T12:00:00.000Z"),
      }),
    ).resolves.not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: missed.id, status: "failed" }),
      ]),
    )
    const deletedMiss = await softDeleteQuest(
      database,
      fixture.first,
      { expectedVersion: failed!.version, questId: failed!.id },
      new Date("2026-08-08T18:05:00.000Z"),
    )
    await expect(
      getQuestList(fixture.first, "today", {
        database,
        localDate: "2026-08-08",
        now: activityTime,
      }),
    ).resolves.not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: missed.id, status: "failed" }),
      ]),
    )
    await expect(
      getQuestList(fixture.first, "deleted", {
        database,
        now: new Date("2026-08-08T18:10:00.000Z"),
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: missed.id, status: "failed" }),
      ]),
    )

    const rescheduled = await restoreQuestWithSchedule(
      database,
      fixture.first,
      {
        dueAt: new Date("2026-08-09T11:30:00.000Z"),
        expectedVersion: deletedMiss.version,
        questId: missed.id,
        startAt: new Date("2026-08-09T03:30:00.000Z"),
      },
      new Date("2026-08-08T18:10:00.000Z"),
    )
    await expect(
      getQuestList(fixture.first, "today", {
        database,
        localDate: "2026-08-09",
        now: new Date("2026-08-08T18:10:00.000Z"),
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          deletedAt: null,
          dueAt: "2026-08-09T11:30:00.000Z",
          id: rescheduled.id,
          startAt: "2026-08-09T03:30:00.000Z",
          status: "open",
        }),
      ]),
    )

    await expect(
      getDailyXpSummary(fixture.first, "2026-08-08", database),
    ).resolves.toEqual({ earned: 35, lost: 35, net: 0 })
  })
})
