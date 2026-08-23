// @vitest-environment node

import { randomUUID } from "node:crypto"

import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { createDatabase, type Database } from "@/db/client"
import {
  accounts,
  activityEvents,
  attachments,
  gates,
  groupStudyActivities,
  groupStudyParticipants,
  groupStudySessions,
  inAppNotifications,
  labels,
  pushSubscriptions,
  questLabels,
  reminderDeliveries,
  reminders,
  sessions,
  tasks,
  timerSessions,
  userProgression,
  userSettings,
  users,
  workspaceMembers,
  workspaces,
  xpLedger,
} from "@/db/schema"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { buildAccountExport } from "@/features/authentication/export/account-export-service"
import { deleteUserAndOwnedData } from "@/features/authentication/mutations/account-deletion-service"
import {
  listActiveSessionRecords,
  revokeSessionRecord,
} from "@/features/authentication/repositories/session-management-repository"
import { provisionPersonalWorkspace } from "@/features/workspaces/application/provision-personal-workspace"
import { findWorkspaceAccess } from "@/features/workspaces/infrastructure/workspace-access-repository"
import { clearReminderFixtures } from "@/test/clear-reminder-fixtures"

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const integrationDescribe = testDatabaseUrl
  ? describe.sequential
  : describe.skip

async function createUser(
  database: Database,
  name: string,
): Promise<{ access: AccessContext; userId: string }> {
  const userId = randomUUID()
  await database.insert(users).values({
    email: `acct-${userId}@example.com`,
    id: userId,
    name,
  })
  const workspaceId = await provisionPersonalWorkspace(database, {
    id: userId,
    name,
  })
  const access = await findWorkspaceAccess(database, {
    userId,
    workspaceId,
  })
  if (!access) throw new Error("Expected account fixture workspace access")
  return { access, userId }
}

async function seedWorkspaceContent(
  database: Database,
  owner: AccessContext,
): Promise<void> {
  await database.insert(tasks).values({
    createdByUserId: owner.userId,
    priority: "high",
    status: "open",
    title: "Purge candidate",
    workspaceId: owner.workspaceId,
  })
  await database.insert(gates).values({
    createdByUserId: owner.userId,
    name: "Home list",
    workspaceId: owner.workspaceId,
  })
  await database.insert(labels).values({
    colorToken: "system-blue",
    createdByUserId: owner.userId,
    name: "Focus",
    workspaceId: owner.workspaceId,
  })
  const [task] = await database
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.workspaceId, owner.workspaceId))
  const [label] = await database
    .select({ id: labels.id })
    .from(labels)
    .where(eq(labels.workspaceId, owner.workspaceId))
  if (task && label) {
    await database.insert(questLabels).values({
      createdByUserId: owner.userId,
      labelId: label.id,
      questId: task.id,
      workspaceId: owner.workspaceId,
    })
  }
  const [reminder] = await database
    .insert(reminders)
    .values({
      channel: "in_app",
      idempotencyKey: `rem-${randomUUID()}`,
      nextAttemptAt: new Date("2026-08-21T09:00:00.000Z"),
      questId: task?.id ?? randomUUID(),
      remindAt: new Date("2026-08-21T09:00:00.000Z"),
      status: "pending",
      timezone: "UTC",
      userId: owner.userId,
      workspaceId: owner.workspaceId,
    })
    .returning({ id: reminders.id })
  if (task && reminder) {
    await database.insert(inAppNotifications).values({
      kind: "quest_reminder_due",
      questId: task.id,
      reminderId: reminder.id,
      userId: owner.userId,
      workspaceId: owner.workspaceId,
    })
  }
  await database.insert(timerSessions).values({
    accumulatedMs: 1_000,
    endedAt: new Date("2026-08-20T10:01:00.000Z"),
    lastStartedAt: null,
    startedAt: new Date("2026-08-20T10:00:00.000Z"),
    status: "completed",
    subject: "Deep work",
    updatedAt: new Date("2026-08-20T10:01:00.000Z"),
    userId: owner.userId,
    workspaceId: owner.workspaceId,
  })
  const [event] = await database
    .insert(activityEvents)
    .values({
      actorUserId: owner.userId,
      eventType: "quest_completed",
      idempotencyKey: `evt-${randomUUID()}`,
      occurredAt: new Date("2026-08-20T10:01:00.000Z"),
      payload: {
        currentStreak: 0,
        priority: "high",
        questTitle: "Purge candidate",
        questVersion: 1,
        rank: "E",
        rankAdvanced: false,
        streakIncreased: false,
        timezone: "UTC",
        totalXp: 12,
        xpDelta: 12,
      },
      subjectId: task?.id ?? randomUUID(),
      workspaceId: owner.workspaceId,
    })
    .returning({ id: activityEvents.id })
  if (task && event) {
    await database.insert(xpLedger).values({
      activityEventId: event.id,
      earnedForLocalDate: "2026-08-20",
      questId: task.id,
      reason: "quest_completion",
      userId: owner.userId,
      workspaceId: owner.workspaceId,
      xpDelta: 12,
    })
  }
  // Provisioning already seeds the progression projection; level it up.
  await database
    .update(userProgression)
    .set({ experiencePoints: 120, hunterLevel: 2 })
    .where(eq(userProgression.userId, owner.userId))
  // Provisioning already seeds user settings.
  await database.insert(pushSubscriptions).values({
    auth: "auth",
    endpoint: `https://push.example.test/${randomUUID()}`,
    p256dh: "p256dh",
    userId: owner.userId,
  })
  await database.insert(attachments).values({
    expectedByteSize: 10,
    questId: task?.id ?? randomUUID(),
    requestedContentType: "application/pdf",
    storageKey: `workspaces/${owner.workspaceId}/tasks/att-${randomUUID()}`,
    uploadExpiresAt: new Date(Date.now() + 60_000),
    uploadedByUserId: owner.userId,
    workspaceId: owner.workspaceId,
  })
}

integrationDescribe("account security and data lifecycle", () => {
  let database: Database

  beforeAll(() => {
    if (!testDatabaseUrl) {
      throw new Error("TEST_DATABASE_URL is required for integration tests")
    }
    database = createDatabase(testDatabaseUrl)
  })

  beforeEach(async () => {
    await clearReminderFixtures(database)
    await database.delete(groupStudyActivities)
    await database.delete(groupStudyParticipants)
    await database.delete(groupStudySessions)
    await database.delete(timerSessions)
    await database.delete(questLabels)
    await database.delete(tasks)
    await database.delete(labels)
    await database.delete(gates)
    await database.delete(workspaces)
    await database.delete(users)
  })

  afterAll(async () => {
    if (database) await database.$client.end({ timeout: 2 })
  })

  it("lists and revokes sessions without touching other users", async () => {
    const first = await createUser(database, "Ada Lovelace")
    const second = await createUser(database, "Grace Hopper")
    const now = new Date()
    await database.insert(sessions).values([
      {
        expiresAt: new Date(now.getTime() + 86_400_000),
        token: `tok-a-${randomUUID()}`,
        userId: second.userId,
      },
      {
        expiresAt: new Date(now.getTime() + 86_400_000),
        token: `tok-b-${randomUUID()}`,
        userId: second.userId,
      },
      {
        expiresAt: new Date(now.getTime() - 1_000),
        token: `tok-expired-${randomUUID()}`,
        userId: second.userId,
      },
    ])

    const active = await listActiveSessionRecords(database, second.userId, now)
    expect(active).toHaveLength(2)

    expect(
      await revokeSessionRecord(database, {
        sessionId: active[1]?.id ?? "",
        userId: second.userId,
      }),
    ).toBe(true)
    // A session owned by somebody else can never be revoked through this path.
    expect(
      await revokeSessionRecord(database, {
        sessionId: active[0]?.id ?? "",
        userId: first.userId,
      }),
    ).toBe(false)

    expect(
      await listActiveSessionRecords(database, second.userId, now),
    ).toHaveLength(1)
  })

  it("exports the workspace snapshot as a serializable payload", async () => {
    const owner = await createUser(database, "Ada Lovelace")
    await seedWorkspaceContent(database, owner.access)

    const payload = await buildAccountExport(database, owner.access, {
      email: "ada@example.com",
      name: "Ada Lovelace",
    })

    expect(() => JSON.stringify(payload)).not.toThrow()
    expect(payload.account).toMatchObject({
      email: "ada@example.com",
      name: "Ada Lovelace",
    })
    const tasks = payload.tasks as ReadonlyArray<{ title: string }>
    expect(tasks[0]?.title).toBe("Purge candidate")
    expect(payload.progression).toMatchObject({ hunterLevel: 2 })
  })

  it("purges the account and every owned record while preserving others", async () => {
    const owner = await createUser(database, "Ada Lovelace")
    const outsider = await createUser(database, "Grace Hopper")
    await seedWorkspaceContent(database, owner.access)

    // The outsider joins a room hosted inside the owner's workspace.
    await database.insert(groupStudySessions).values({
      expiresAt: new Date(Date.now() + 3_600_000),
      hostUserId: owner.userId,
      joinCode: randomUUID().slice(0, 8).toUpperCase(),
      subject: "Purge room",
      workspaceId: owner.access.workspaceId,
    })
    const [room] = await database
      .select({ id: groupStudySessions.id })
      .from(groupStudySessions)
    const [outsiderTimer] = await database
      .insert(timerSessions)
      .values({
        accumulatedMs: 0,
        startedAt: new Date(),
        status: "running",
        subject: "Purge room",
        updatedAt: new Date(),
        userId: outsider.userId,
        workspaceId: outsider.access.workspaceId,
      })
      .returning({ id: timerSessions.id })
    await database.insert(workspaceMembers).values({
      role: "member",
      userId: outsider.userId,
      workspaceId: owner.access.workspaceId,
    })
    if (room && outsiderTimer) {
      await database.insert(groupStudyParticipants).values({
        groupSessionId: room.id,
        timerSessionId: outsiderTimer.id,
        userId: outsider.userId,
      })
    }

    // A second active login must die with the account.
    await database.insert(sessions).values({
      expiresAt: new Date(Date.now() + 86_400_000),
      token: `tok-final-${randomUUID()}`,
      userId: owner.userId,
    })

    const summary = await deleteUserAndOwnedData(database, owner.userId)
    expect(summary.attachmentKeys).toHaveLength(1)
    expect(summary.personalWorkspaceIds).toEqual([owner.access.workspaceId])

    // Every owned record is gone; the outsider's user row remains.
    expect(await database.select().from(users)).toHaveLength(1)
    expect(
      await database
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.id, owner.access.workspaceId)),
    ).toHaveLength(0)
    for (const table of [
      tasks,
      gates,
      labels,
      questLabels,
      reminders,
      reminderDeliveries,
      inAppNotifications,
      attachments,
      xpLedger,
      activityEvents,
      pushSubscriptions,
      sessions,
      accounts,
      groupStudySessions,
      groupStudyParticipants,
    ]) {
      expect(await database.select().from(table)).toHaveLength(0)
    }

    // Owner-scoped projections die with the account; the survivor keeps theirs.
    expect(
      await database
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, owner.userId)),
    ).toHaveLength(0)
    expect(
      await database
        .select()
        .from(userProgression)
        .where(eq(userProgression.userId, owner.userId)),
    ).toHaveLength(0)

    // The outsider survives with their own workspace and timer intact.
    const survivingUser = await database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, outsider.userId))
    expect(survivingUser).toHaveLength(1)
    const survivingTimers = await database
      .select({ id: timerSessions.id })
      .from(timerSessions)
      .where(eq(timerSessions.userId, outsider.userId))
    expect(survivingTimers).toHaveLength(1)
    const survivingWorkspaces = await database
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, outsider.access.workspaceId))
    expect(survivingWorkspaces).toHaveLength(1)
  })
})
