// @vitest-environment node

import { randomUUID } from "node:crypto"

import { eq } from "drizzle-orm"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { createDatabase, type Database } from "@/db/client"
import {
  gates,
  inAppNotifications,
  labels,
  questLabels,
  reminderDeliveries,
  reminders,
  tasks,
  userSettings,
  users,
  workspaces,
} from "@/db/schema"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import {
  completeQuest,
  createQuest,
} from "@/features/quests/mutations/quest-mutation-service"
import { getQuestList } from "@/features/quests/queries/quest-query-service"
import { createQuestSchema } from "@/features/quests/validation/quest-validation"
import {
  ReminderProviderError,
  type ReminderDeliveryProvider,
} from "@/features/reminders/delivery/reminder-delivery-provider"
import {
  cancelReminder,
  createReminder,
  updateReminder,
} from "@/features/reminders/mutations/reminder-mutation-service"
import { updateUserTimezone } from "@/features/reminders/mutations/user-settings-service"
import { processDueReminders } from "@/features/reminders/processing/reminder-processor"
import {
  getReminderInbox,
  getReminderList,
} from "@/features/reminders/queries/reminder-query-service"
import { getUserSettings } from "@/features/reminders/queries/user-settings-query-service"
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

async function seedUser(database: Database, label: string) {
  const userId = randomUUID()
  await database.insert(users).values({
    email: `${label}-${userId}@example.com`,
    id: userId,
    name: `${label} Reminder User`,
  })
  const workspaceId = await provisionPersonalWorkspace(database, {
    id: userId,
    name: `${label} Reminder User`,
  })
  const access = await findWorkspaceAccess(database, { userId, workspaceId })
  if (!access) throw new Error("Expected reminder fixture access")
  return access
}

function questCommand(overrides: Record<string, unknown> = {}) {
  return createQuestSchema.parse({
    description: "Reminder integration Quest",
    dueAt: new Date("2026-08-10T09:00:00.000Z"),
    priority: "medium",
    startAt: null,
    title: "Reminder Quest",
    ...overrides,
  })
}

integrationDescribe("recurring Quest and reminder subsystem", () => {
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
    fixture = {
      first: await seedUser(database, "first"),
      second: await seedUser(database, "second"),
    }
  })

  afterAll(async () => {
    if (database) await database.$client.end({ timeout: 2 })
  })

  it("persists an IANA timezone with optimistic conflict protection", async () => {
    const current = await getUserSettings(fixture.first, database)
    const updated = await updateUserTimezone(database, fixture.first, {
      expectedVersion: current.version,
      timezone: "America/New_York",
    })

    expect(updated).toMatchObject({ timezone: "America/New_York", version: 2 })
    await expect(
      updateUserTimezone(database, fixture.first, {
        expectedVersion: current.version,
        timezone: "Europe/London",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" })
    const [workspace] = await database
      .select({ timezone: workspaces.timezone })
      .from(workspaces)
      .where(eq(workspaces.id, fixture.first.workspaceId))
    expect(workspace?.timezone).toBe("America/New_York")
  })

  it("only derives automatic alerts for tasks due in under 30 minutes", async () => {
    const now = new Date("2026-08-15T08:00:00.000Z")
    const urgent = await createQuest(
      database,
      fixture.first,
      questCommand({
        dueAt: new Date("2026-08-15T08:29:59.000Z"),
        title: "Urgent deadline",
      }),
    )
    const completedUrgent = await createQuest(
      database,
      fixture.first,
      questCommand({
        dueAt: new Date("2026-08-15T08:10:00.000Z"),
        title: "Completed urgent task",
      }),
    )
    await completeQuest(
      database,
      fixture.first,
      {
        expectedVersion: completedUrgent.version,
        questId: completedUrgent.id,
      },
      now,
    )
    await createQuest(
      database,
      fixture.first,
      questCommand({
        dueAt: new Date("2026-08-15T07:59:59.000Z"),
        title: "Expired task",
      }),
    )
    await createQuest(
      database,
      fixture.first,
      questCommand({
        dueAt: new Date("2026-08-15T08:30:00.000Z"),
        title: "Boundary deadline",
      }),
    )
    await createQuest(
      database,
      fixture.first,
      questCommand({
        dueAt: new Date("2026-08-15T09:00:00.000Z"),
        title: "Later deadline",
      }),
    )

    const inbox = await getReminderInbox(fixture.first, { database, now })

    expect(inbox.dueSoonQuests).toEqual([
      expect.objectContaining({ id: urgent.id, title: "Urgent deadline" }),
    ])
    expect(inbox).not.toHaveProperty("notifications")
  })

  it("creates, version-edits, and idempotently cancels an authorized reminder", async () => {
    const quest = await createQuest(database, fixture.first, questCommand())
    const created = await createReminder(
      database,
      fixture.first,
      {
        channel: "in_app",
        questId: quest.id,
        remindAt: new Date("2026-08-10T08:00:00.000Z"),
        timezone: "UTC",
      },
      new Date("2026-08-09T08:00:00.000Z"),
    )

    await expect(
      updateReminder(
        database,
        fixture.second,
        {
          channel: "email",
          expectedVersion: created.version,
          questId: quest.id,
          remindAt: new Date("2026-08-10T07:30:00.000Z"),
          reminderId: created.id,
          timezone: "UTC",
        },
        new Date("2026-08-09T08:00:00.000Z"),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })

    const updated = await updateReminder(
      database,
      fixture.first,
      {
        channel: "email",
        expectedVersion: created.version,
        questId: quest.id,
        remindAt: new Date("2026-08-10T07:30:00.000Z"),
        reminderId: created.id,
        timezone: "UTC",
      },
      new Date("2026-08-09T08:00:00.000Z"),
    )
    const cancelled = await cancelReminder(database, fixture.first, {
      expectedVersion: updated.version,
      reminderId: updated.id,
    })
    const repeated = await cancelReminder(database, fixture.first, {
      expectedVersion: updated.version,
      reminderId: updated.id,
    })

    expect(cancelled.status).toBe("cancelled")
    expect(repeated).toEqual(cancelled)
  })

  it("delivers once under duplicate worker invocation and records an in-app notification", async () => {
    const quest = await createQuest(database, fixture.first, questCommand())
    await createReminder(
      database,
      fixture.first,
      {
        channel: "email",
        questId: quest.id,
        remindAt: new Date("2026-08-10T08:00:00.000Z"),
        timezone: "UTC",
      },
      new Date("2026-08-09T08:00:00.000Z"),
    )
    const send = vi.fn().mockResolvedValue({ providerMessageId: "email_1" })
    const provider: ReminderDeliveryProvider = { send }
    const now = new Date("2026-08-10T08:00:00.000Z")

    const first = await processDueReminders(database, provider, { now })
    const duplicate = await processDueReminders(database, provider, { now })

    expect(first).toMatchObject({ delivered: 1, processed: 1 })
    expect(duplicate).toMatchObject({ delivered: 0, processed: 0 })
    expect(send).toHaveBeenCalledTimes(1)
    await expect(
      database.select().from(reminderDeliveries),
    ).resolves.toHaveLength(1)
    await expect(
      database.select().from(inAppNotifications),
    ).resolves.toHaveLength(1)
  })

  it("retries with a cap and logs only operational identifiers", async () => {
    const quest = await createQuest(
      database,
      fixture.first,
      questCommand({ title: "Private medical appointment" }),
    )
    await createReminder(
      database,
      fixture.first,
      {
        channel: "email",
        questId: quest.id,
        remindAt: new Date("2026-08-10T08:00:00.000Z"),
        timezone: "UTC",
      },
      new Date("2026-08-09T08:00:00.000Z"),
    )
    const provider: ReminderDeliveryProvider = {
      send: vi
        .fn()
        .mockRejectedValue(new ReminderProviderError("test_failure")),
    }
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined)

    await processDueReminders(database, provider, {
      now: new Date("2026-08-10T08:00:00.000Z"),
    })
    await processDueReminders(database, provider, {
      now: new Date("2026-08-10T08:01:00.000Z"),
    })
    const final = await processDueReminders(database, provider, {
      now: new Date("2026-08-10T08:06:00.000Z"),
    })

    expect(final).toMatchObject({ failed: 1, processed: 1 })
    const [record] = await database.select().from(reminders)
    expect(record).toMatchObject({ attemptCount: 3, status: "failed" })
    const logged = JSON.stringify(log.mock.calls)
    expect(logged).not.toContain("Private medical appointment")
    expect(logged).not.toContain("@example.com")
    log.mockRestore()
  })

  it("creates the next recurring Quest and carries reminder lead time across DST", async () => {
    await database
      .update(userSettings)
      .set({ timezone: "America/New_York" })
      .where(eq(userSettings.userId, fixture.first.userId))
    const quest = await createQuest(
      database,
      fixture.first,
      questCommand({
        dueAt: new Date("2026-03-07T14:00:00.000Z"),
        recurrenceRule: "RRULE:FREQ=DAILY",
        title: "Daily local Quest",
      }),
    )
    await createReminder(
      database,
      fixture.first,
      {
        channel: "in_app",
        questId: quest.id,
        remindAt: new Date("2026-03-07T13:00:00.000Z"),
        timezone: "America/New_York",
      },
      new Date("2026-03-01T12:00:00.000Z"),
    )

    await completeQuest(
      database,
      fixture.first,
      { expectedVersion: quest.version, questId: quest.id },
      new Date("2026-03-07T15:00:00.000Z"),
    )

    const [successor] = await getQuestList(fixture.first, "active", {
      database,
    })
    expect(successor).toMatchObject({
      dueAt: "2026-03-08T13:00:00.000Z",
      recurrenceSequence: 1,
      recurrenceTimezone: "America/New_York",
      title: "Daily local Quest",
    })
    const schedules = await getReminderList(fixture.first, database)
    expect(schedules.map(({ remindAt }) => remindAt).sort()).toEqual([
      "2026-03-07T13:00:00.000Z",
      "2026-03-08T12:00:00.000Z",
    ])
  })
})
