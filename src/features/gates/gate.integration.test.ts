// @vitest-environment node

import { randomUUID } from "node:crypto"

import { eq } from "drizzle-orm"
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
  archiveGate,
  createGate,
  editGate,
  restoreGate,
  softDeleteGate,
} from "@/features/gates/mutations/gate-mutation-service"
import { getGateList } from "@/features/gates/queries/gate-query-service"
import {
  createGateSchema,
  editGateSchema,
} from "@/features/gates/validation/gate-validation"
import {
  createQuest,
  editQuest,
} from "@/features/quests/mutations/quest-mutation-service"
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
      email: `gate-first-${firstUserId}@example.com`,
      id: firstUserId,
      name: "First Gate User",
    },
    {
      email: `gate-second-${secondUserId}@example.com`,
      id: secondUserId,
      name: "Second Gate User",
    },
  ])
  const firstWorkspaceId = await provisionPersonalWorkspace(database, {
    id: firstUserId,
    name: "First Gate User",
  })
  const secondWorkspaceId = await provisionPersonalWorkspace(database, {
    id: secondUserId,
    name: "Second Gate User",
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

function gateCommand(overrides: Readonly<Record<string, unknown>> = {}) {
  return createGateSchema.parse({
    accentToken: "mana-violet",
    description: "A repository-backed Gate.",
    name: "Integration Gate",
    ...overrides,
  })
}

function questCommand(overrides: Readonly<Record<string, unknown>> = {}) {
  return createQuestSchema.parse({
    description: "A Quest used to exercise Gate rules.",
    dueAt: "2026-08-08T13:00",
    priority: "high",
    startAt: "2026-08-08T09:00",
    title: "Gated Quest",
    ...overrides,
  })
}

integrationDescribe("Gate repository and application services", () => {
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

  it("runs create, edit, archive, restore, and delete with quest counts", async () => {
    const created = await createGate(database, fixture.first, gateCommand())
    expect(created.version).toBe(1)

    let active = await getGateList(fixture.first, "active", { database })
    expect(active).toHaveLength(1)
    expect(active[0]).toMatchObject({
      id: created.id,
      name: "Integration Gate",
      questCount: 0,
    })

    const edited = await editGate(
      database,
      fixture.first,
      editGateSchema.parse({
        accentToken: "spectral-cyan",
        description: "Updated safely.",
        expectedVersion: created.version,
        gateId: created.id,
        name: "Edited Gate",
      }),
    )
    expect(edited.version).toBe(2)

    const quest = await createQuest(
      database,
      fixture.first,
      questCommand({ projectId: created.id }),
    )
    active = await getGateList(fixture.first, "active", { database })
    expect(active[0]).toMatchObject({ id: created.id, questCount: 1 })

    const archived = await archiveGate(
      database,
      fixture.first,
      { expectedVersion: edited.version, gateId: created.id },
      new Date("2026-08-08T12:00:00.000Z"),
    )
    expect(archived.version).toBe(3)
    await expect(
      getGateList(fixture.first, "active", { database }),
    ).resolves.toHaveLength(0)
    await expect(
      getGateList(fixture.first, "archived", { database }),
    ).resolves.toMatchObject([
      { archivedAt: "2026-08-08T12:00:00.000Z", id: created.id },
    ])

    // Unrelated Quest edits preserve an existing archived Gate assignment.
    const questInArchivedGate = await editQuest(
      database,
      fixture.first,
      editQuestSchema.parse({
        description: "Edited while the Gate is archived.",
        dueAt: "2026-08-08T13:00",
        expectedVersion: quest.version,
        priority: "high",
        projectId: created.id,
        questId: quest.id,
        startAt: "2026-08-08T09:00",
        title: "Still Gated Quest",
      }),
    )

    const restored = await restoreGate(database, fixture.first, {
      expectedVersion: archived.version,
      gateId: created.id,
    })
    expect(restored.version).toBe(4)

    // Deletion rule: a Gate still holding Quests cannot be deleted.
    await expect(
      softDeleteGate(database, fixture.first, {
        expectedVersion: restored.version,
        gateId: created.id,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" })

    // Empty the Gate, then deletion succeeds.
    const current = (
      await getGateList(fixture.first, "active", { database })
    )[0]
    await editQuest(
      database,
      fixture.first,
      editQuestSchema.parse({
        description: "Moved out of the Gate.",
        dueAt: "2026-08-08T13:00",
        expectedVersion: questInArchivedGate.version,
        priority: "high",
        projectId: "",
        questId: quest.id,
        startAt: "2026-08-08T09:00",
        title: "Ungated Quest",
      }),
    )

    const deleted = await softDeleteGate(database, fixture.first, {
      expectedVersion: current?.version ?? restored.version,
      gateId: created.id,
    })
    expect(deleted.version).toBeGreaterThan(4)
    await expect(
      getGateList(fixture.first, "active", { database }),
    ).resolves.toHaveLength(0)
  })

  it("denies cross-workspace reads, writes, and fabricated contexts", async () => {
    const created = await createGate(database, fixture.first, gateCommand())

    await expect(
      getGateList(fixture.second, "active", { database }),
    ).resolves.toHaveLength(0)
    await expect(
      editGate(
        database,
        fixture.second,
        editGateSchema.parse({
          ...gateCommand(),
          expectedVersion: created.version,
          gateId: created.id,
          name: "Cross-workspace overwrite",
        }),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(
      archiveGate(database, fixture.second, {
        expectedVersion: created.version,
        gateId: created.id,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })

    const fabricated = {
      ...fixture.first,
      userId: fixture.second.userId,
    }
    await expect(
      createGate(database, fabricated, gateCommand()),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })

    const persisted = await getGateList(fixture.first, "active", { database })
    expect(persisted[0]?.name).toBe("Integration Gate")
  })

  it("detects stale optimistic-concurrency versions without overwriting", async () => {
    const created = await createGate(database, fixture.first, gateCommand())
    await editGate(
      database,
      fixture.first,
      editGateSchema.parse({
        ...gateCommand(),
        expectedVersion: created.version,
        gateId: created.id,
        name: "Winning update",
      }),
    )

    await expect(
      editGate(
        database,
        fixture.first,
        editGateSchema.parse({
          ...gateCommand(),
          expectedVersion: created.version,
          gateId: created.id,
          name: "Stale update",
        }),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" })

    const [persisted] = await getGateList(fixture.first, "active", {
      database,
    })
    expect(persisted).toMatchObject({ name: "Winning update", version: 2 })
  })

  it("returns a safe validation error for duplicate names", async () => {
    await createGate(database, fixture.first, gateCommand())

    await expect(
      createGate(
        database,
        fixture.first,
        gateCommand({ name: "integration gate" }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" })
  })

  it("serializes Gate deletion against new Quest assignment", async () => {
    const gate = await createGate(database, fixture.first, gateCommand())
    const outcomes = await Promise.allSettled([
      softDeleteGate(database, fixture.first, {
        expectedVersion: gate.version,
        gateId: gate.id,
      }),
      createQuest(
        database,
        fixture.first,
        questCommand({ projectId: gate.id, title: "Racing Quest" }),
      ),
    ])

    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled"),
    ).toHaveLength(1)

    const [persistedGate] = await database
      .select({ deletedAt: gates.deletedAt })
      .from(gates)
      .where(eq(gates.id, gate.id))
    const assignedQuests = await database
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.projectId, gate.id))

    expect(Boolean(persistedGate?.deletedAt) && assignedQuests.length > 0).toBe(
      false,
    )
  })

  it("blocks Quest assignment to missing or archived Gates", async () => {
    await expect(
      createQuest(
        database,
        fixture.first,
        questCommand({ projectId: randomUUID() }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" })

    const gate = await createGate(database, fixture.first, gateCommand())
    await archiveGate(database, fixture.first, {
      expectedVersion: gate.version,
      gateId: gate.id,
    })

    await expect(
      createQuest(
        database,
        fixture.first,
        questCommand({ projectId: gate.id }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" })
  })
})
