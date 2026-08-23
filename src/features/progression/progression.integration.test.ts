// @vitest-environment node

import { randomUUID } from "node:crypto"

import { count, eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { createDatabase, type Database } from "@/db/client"
import {
  activityEvents,
  gates,
  labels,
  questLabels,
  tasks,
  userProgression,
  users,
  workspaces,
  xpLedger,
} from "@/db/schema"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { getProgressionDashboard } from "@/features/progression/queries/progression-query-service"
import {
  completeQuest,
  createQuest,
  failOverdueQuests,
  reopenQuest,
  restoreQuest,
  softDeleteQuest,
} from "@/features/quests/mutations/quest-mutation-service"
import { createQuestSchema } from "@/features/quests/validation/quest-validation"
import { provisionPersonalWorkspace } from "@/features/workspaces/application/provision-personal-workspace"
import { findWorkspaceAccess } from "@/features/workspaces/infrastructure/workspace-access-repository"
import { clearReminderFixtures } from "@/test/clear-reminder-fixtures"

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const integrationDescribe = testDatabaseUrl
  ? describe.sequential
  : describe.skip

async function seedAccess(database: Database): Promise<AccessContext> {
  const userId = randomUUID()
  await database.insert(users).values({
    email: `progress-${userId}@example.com`,
    id: userId,
    name: "Progress Hunter",
  })
  const workspaceId = await provisionPersonalWorkspace(database, {
    id: userId,
    name: "Progress Hunter",
  })
  const access = await findWorkspaceAccess(database, { userId, workspaceId })
  if (!access) throw new Error("Expected progression fixture access")
  return access
}

function questCommand(
  priority: "critical" | "high" = "critical",
  overrides: Record<string, unknown> = {},
) {
  return createQuestSchema.parse({
    description: "A progression integration Quest.",
    dueAt: "",
    priority,
    startAt: "",
    title: `Progression ${priority} Quest`,
    ...overrides,
  })
}

integrationDescribe("server-authoritative progression", () => {
  let database: Database
  let access: AccessContext

  beforeAll(() => {
    if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL is required")
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
    access = await seedAccess(database)
  })

  afterAll(async () => {
    if (database) await database.$client.end({ timeout: 2 })
  })

  it("awards one auditable XP entry when an offline completion is replayed", async () => {
    const quest = await createQuest(database, access, questCommand())
    const mutationId = randomUUID()
    const completedAt = new Date("2026-08-08T12:00:00.000Z")
    const completed = await completeQuest(
      database,
      access,
      { expectedVersion: quest.version, questId: quest.id },
      completedAt,
      mutationId,
    )
    expect(completed.progression).toMatchObject({
      rank: "E",
      totalXp: 50,
      xpDelta: 50,
    })

    const replayed = await completeQuest(
      database,
      access,
      { expectedVersion: quest.version, questId: quest.id },
      completedAt,
      mutationId,
    )
    expect(replayed).toMatchObject({ id: quest.id, version: completed.version })

    const [ledgerCount, eventCount, projection] = await Promise.all([
      database.select({ value: count() }).from(xpLedger),
      database.select({ value: count() }).from(activityEvents),
      database
        .select()
        .from(userProgression)
        .where(eq(userProgression.userId, access.userId)),
    ])
    expect(ledgerCount[0]?.value).toBe(1)
    expect(eventCount[0]?.value).toBe(1)
    expect(projection[0]).toMatchObject({ experiencePoints: 50 })
  })

  it("reverses on reopen, re-awards on a later clear, and rejects stale replay", async () => {
    const quest = await createQuest(database, access, questCommand("high"))
    const completed = await completeQuest(
      database,
      access,
      { expectedVersion: quest.version, questId: quest.id },
      new Date("2026-08-08T12:00:00.000Z"),
    )
    const reopened = await reopenQuest(
      database,
      access,
      { expectedVersion: completed.version, questId: quest.id },
      new Date("2026-08-08T13:00:00.000Z"),
    )
    expect(reopened.progression).toMatchObject({ totalXp: 0, xpDelta: -35 })

    await expect(
      reopenQuest(database, access, {
        expectedVersion: completed.version,
        questId: quest.id,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" })

    const recompleted = await completeQuest(
      database,
      access,
      { expectedVersion: reopened.version, questId: quest.id },
      new Date("2026-08-09T12:00:00.000Z"),
    )
    expect(recompleted.progression).toMatchObject({ totalXp: 35, xpDelta: 35 })

    const ledger = await database
      .select({ delta: xpLedger.xpDelta })
      .from(xpLedger)
    expect(ledger.map(({ delta }) => delta)).toEqual([35, -35, 35])
  })

  it("reverses completed deletion, restores it once, and ignores open deletion", async () => {
    const completedQuest = await createQuest(database, access, questCommand())
    const completed = await completeQuest(
      database,
      access,
      { expectedVersion: completedQuest.version, questId: completedQuest.id },
      new Date("2026-08-08T12:00:00.000Z"),
    )
    const deleted = await softDeleteQuest(
      database,
      access,
      { expectedVersion: completed.version, questId: completed.id },
      new Date("2026-08-08T14:00:00.000Z"),
    )
    expect(deleted.progression).toMatchObject({ totalXp: 0, xpDelta: -50 })

    const restored = await restoreQuest(
      database,
      access,
      { expectedVersion: deleted.version, questId: deleted.id },
      new Date("2026-08-08T15:00:00.000Z"),
    )
    expect(restored.progression).toMatchObject({ totalXp: 50, xpDelta: 50 })

    const openQuest = await createQuest(database, access, questCommand("high"))
    const openDeleted = await softDeleteQuest(database, access, {
      expectedVersion: openQuest.version,
      questId: openQuest.id,
    })
    expect(openDeleted.progression).toMatchObject({ totalXp: 50, xpDelta: 0 })

    const dashboard = await getProgressionDashboard(access, {
      database,
      now: new Date("2026-08-08T18:00:00.000Z"),
    })
    expect(dashboard).toMatchObject({
      currentStreak: 1,
      daily: { xp: 50 },
      totalXp: 50,
      weekly: { xp: 50 },
    })
    expect(dashboard.history.map(({ xpDelta }) => xpDelta)).toEqual([
      50, -50, 50,
    ])
  })

  it("uses scheduled task points as goals while misses reduce earned points", async () => {
    const dueAt = new Date("2026-08-08T10:00:00.000Z")
    const completedQuest = await createQuest(
      database,
      access,
      questCommand("critical", { dueAt, title: "Completed fifty" }),
    )
    await completeQuest(
      database,
      access,
      { expectedVersion: completedQuest.version, questId: completedQuest.id },
      new Date("2026-08-08T09:00:00.000Z"),
    )
    const missedQuest = await createQuest(
      database,
      access,
      questCommand("high", { dueAt, title: "Missed thirty-five" }),
    )

    await expect(
      failOverdueQuests(database, access, new Date("2026-08-08T11:00:00.000Z")),
    ).resolves.toEqual({ failed: 1, xpLost: 35 })

    const unneededQuest = await createQuest(
      database,
      access,
      questCommand("high", { dueAt, title: "No longer needed" }),
    )

    const beforeCancellation = await getProgressionDashboard(access, {
      database,
      now: new Date("2026-08-08T11:00:00.000Z"),
    })
    expect(beforeCancellation).toMatchObject({
      daily: { goal: 120, percent: 12, xp: 15 },
      weekly: { goal: 120, percent: 12, xp: 15 },
    })

    const cancelled = await softDeleteQuest(database, access, {
      expectedVersion: unneededQuest.version,
      questId: unneededQuest.id,
    })
    expect(cancelled.progression).toMatchObject({ totalXp: 15, xpDelta: 0 })

    const afterCancellation = await getProgressionDashboard(access, {
      database,
      now: new Date("2026-08-08T11:00:00.000Z"),
    })
    expect(afterCancellation).toMatchObject({
      daily: { goal: 85, percent: 17, xp: 15 },
      weekly: { goal: 85, percent: 17, xp: 15 },
    })

    await softDeleteQuest(database, access, {
      expectedVersion: missedQuest.version + 1,
      questId: missedQuest.id,
    })
    const afterTrash = await getProgressionDashboard(access, {
      database,
      now: new Date("2026-08-08T11:00:00.000Z"),
    })
    expect(afterTrash).toMatchObject({
      daily: { goal: 85, percent: 17, xp: 15 },
      weekly: { goal: 85, percent: 17, xp: 15 },
    })
  })
})
