// @vitest-environment node

import { randomUUID } from "node:crypto"

import { and, eq } from "drizzle-orm"
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
import {
  assignQuestLabels,
  createLabel,
  editLabel,
  getQuestLabels,
  softDeleteLabel,
} from "@/features/labels/mutations/label-mutation-service"
import { getLabelList } from "@/features/labels/queries/label-query-service"
import {
  createLabelSchema,
  editLabelSchema,
} from "@/features/labels/validation/label-validation"
import { createQuest } from "@/features/quests/mutations/quest-mutation-service"
import { getQuestList } from "@/features/quests/queries/quest-query-service"
import { createQuestSchema } from "@/features/quests/validation/quest-validation"
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
      email: `label-first-${firstUserId}@example.com`,
      id: firstUserId,
      name: "First Label User",
    },
    {
      email: `label-second-${secondUserId}@example.com`,
      id: secondUserId,
      name: "Second Label User",
    },
  ])
  const firstWorkspaceId = await provisionPersonalWorkspace(database, {
    id: firstUserId,
    name: "First Label User",
  })
  const secondWorkspaceId = await provisionPersonalWorkspace(database, {
    id: secondUserId,
    name: "Second Label User",
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

function labelCommand(overrides: Readonly<Record<string, unknown>> = {}) {
  return createLabelSchema.parse({
    colorToken: "spectral-cyan",
    name: "Integration Label",
    ...overrides,
  })
}

function questCommand(overrides: Readonly<Record<string, unknown>> = {}) {
  return createQuestSchema.parse({
    description: "A Quest used to exercise Label rules.",
    dueAt: "2026-08-08T13:00",
    priority: "high",
    startAt: "2026-08-08T09:00",
    title: "Labelled Quest",
    ...overrides,
  })
}

integrationDescribe("Label repository and application services", () => {
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

  it("runs create, edit, attach, detach, and delete", async () => {
    const created = await createLabel(database, fixture.first, labelCommand())
    expect(created.version).toBe(1)

    const edited = await editLabel(
      database,
      fixture.first,
      editLabelSchema.parse({
        colorToken: "status-warning",
        expectedVersion: created.version,
        labelId: created.id,
        name: "Edited Label",
      }),
    )
    expect(edited.version).toBe(2)

    let list = await getLabelList(fixture.first, { database })
    expect(list).toMatchObject([
      { colorToken: "status-warning", id: created.id, name: "Edited Label" },
    ])

    const quest = await createQuest(database, fixture.first, questCommand())
    const secondLabel = await createLabel(
      database,
      fixture.first,
      labelCommand({ colorToken: "mana-violet", name: "Second Label" }),
    )

    // Attach: the Quest's label set is replaced wholesale.
    const attached = await assignQuestLabels(database, fixture.first, {
      expectedVersion: quest.version,
      labelIds: [created.id, secondLabel.id],
      questId: quest.id,
    })
    expect(attached.version).toBe(quest.version + 1)
    await expect(
      getQuestLabels(database, fixture.first, quest.id),
    ).resolves.toEqual(expect.arrayContaining([created.id, secondLabel.id]))

    let active = await getQuestList(fixture.first, "active", { database })
    expect(active[0]?.labels).toHaveLength(2)

    // A stale relationship update cannot overwrite the winning label set.
    await expect(
      assignQuestLabels(database, fixture.first, {
        expectedVersion: quest.version,
        labelIds: [],
        questId: quest.id,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" })
    await expect(
      getQuestLabels(database, fixture.first, quest.id),
    ).resolves.toEqual(expect.arrayContaining([created.id, secondLabel.id]))

    // The label filter narrows results server-side.
    await expect(
      getQuestList(fixture.first, "active", {
        database,
        filters: { labelId: created.id },
      }),
    ).resolves.toHaveLength(1)

    // Detach: assigning an empty set clears the Quest's labels.
    const detached = await assignQuestLabels(database, fixture.first, {
      expectedVersion: attached.version,
      labelIds: [],
      questId: quest.id,
    })
    await expect(
      getQuestLabels(database, fixture.first, quest.id),
    ).resolves.toEqual([])
    await expect(
      getQuestList(fixture.first, "active", {
        database,
        filters: { labelId: created.id },
      }),
    ).resolves.toHaveLength(0)

    // Deleting a Label also clears its attachments.
    await assignQuestLabels(database, fixture.first, {
      expectedVersion: detached.version,
      labelIds: [created.id],
      questId: quest.id,
    })
    const deleted = await softDeleteLabel(database, fixture.first, {
      expectedVersion: edited.version,
      labelId: created.id,
    })
    expect(deleted.version).toBe(3)
    await expect(
      database
        .select()
        .from(questLabels)
        .where(eq(questLabels.labelId, created.id)),
    ).resolves.toEqual([])
    list = await getLabelList(fixture.first, { database })
    expect(list).toMatchObject([{ id: secondLabel.id, name: "Second Label" }])
    active = await getQuestList(fixture.first, "active", { database })
    expect(active[0]?.labels).toEqual([])
  })

  it("denies cross-workspace reads, writes, and fabricated contexts", async () => {
    const created = await createLabel(database, fixture.first, labelCommand())
    const quest = await createQuest(database, fixture.first, questCommand())
    const foreignLabel = await createLabel(
      database,
      fixture.second,
      labelCommand({ name: "Foreign Label" }),
    )
    const foreignQuest = await createQuest(
      database,
      fixture.second,
      questCommand({ title: "Foreign Quest" }),
    )

    await expect(
      getLabelList(fixture.second, { database }),
    ).resolves.toMatchObject([{ name: "Foreign Label" }])
    await expect(
      editLabel(
        database,
        fixture.second,
        editLabelSchema.parse({
          colorToken: "spectral-cyan",
          expectedVersion: created.version,
          labelId: created.id,
          name: "Cross-workspace overwrite",
        }),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })

    // Attachments cannot cross the workspace boundary in either direction.
    await expect(
      assignQuestLabels(database, fixture.first, {
        expectedVersion: quest.version,
        labelIds: [foreignLabel.id],
        questId: quest.id,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(
      assignQuestLabels(database, fixture.first, {
        expectedVersion: quest.version,
        labelIds: [created.id],
        questId: foreignQuest.id,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })

    const fabricated = {
      ...fixture.first,
      userId: fixture.second.userId,
    }
    await expect(
      createLabel(database, fabricated, labelCommand()),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })

    const persisted = await getLabelList(fixture.first, { database })
    expect(persisted[0]?.name).toBe("Integration Label")
  })

  it("detects stale optimistic-concurrency versions without overwriting", async () => {
    const created = await createLabel(database, fixture.first, labelCommand())
    await editLabel(
      database,
      fixture.first,
      editLabelSchema.parse({
        colorToken: "spectral-cyan",
        expectedVersion: created.version,
        labelId: created.id,
        name: "Winning update",
      }),
    )

    await expect(
      editLabel(
        database,
        fixture.first,
        editLabelSchema.parse({
          colorToken: "spectral-cyan",
          expectedVersion: created.version,
          labelId: created.id,
          name: "Stale update",
        }),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" })

    const [persisted] = await getLabelList(fixture.first, { database })
    expect(persisted).toMatchObject({ name: "Winning update", version: 2 })
  })

  it("returns a safe validation error for duplicate names", async () => {
    await createLabel(database, fixture.first, labelCommand())

    await expect(
      createLabel(
        database,
        fixture.first,
        labelCommand({ name: "integration label" }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" })
  })

  it("serializes Label deletion against assignment replacement", async () => {
    const label = await createLabel(database, fixture.first, labelCommand())
    const quest = await createQuest(database, fixture.first, questCommand())
    const outcomes = await Promise.allSettled([
      softDeleteLabel(database, fixture.first, {
        expectedVersion: label.version,
        labelId: label.id,
      }),
      assignQuestLabels(database, fixture.first, {
        expectedVersion: quest.version,
        labelIds: [label.id],
        questId: quest.id,
      }),
    ])

    expect(outcomes[0]?.status).toBe("fulfilled")
    await expect(
      database
        .select()
        .from(questLabels)
        .where(
          and(
            eq(questLabels.questId, quest.id),
            eq(questLabels.labelId, label.id),
          ),
        ),
    ).resolves.toEqual([])
  })
})
