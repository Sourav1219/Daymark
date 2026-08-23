// @vitest-environment node

import { randomUUID } from "node:crypto"

import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { createDatabase, type Database } from "@/db/client"
import {
  activityEvents,
  gates,
  groupStudyActivities,
  groupStudyJoinRequests,
  groupStudyParticipants,
  groupStudySessions,
  labels,
  questLabels,
  tasks,
  timerSessions,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema"
import type { AccessContext } from "@/features/authentication/authorization/access-context"
import {
  createGroupStudySession,
  joinGroupStudySession,
  moderateGroupStudyParticipant,
  regenerateGroupStudyJoinCode,
  respondToJoinRequest,
  setGroupStudyJoinLocked,
  updateGroupStudySettings,
} from "@/features/timer/mutations/group-study-mutation-service"
import {
  pauseTimer,
  resumeTimer,
  stopTimer,
} from "@/features/timer/mutations/timer-mutation-service"
import { getTimerDashboard } from "@/features/timer/queries/timer-query-service"
import {
  findGroupStudySessionRecord,
  findPendingJoinRequestsForRoom,
} from "@/features/timer/repositories/group-study-repository"
import { provisionPersonalWorkspace } from "@/features/workspaces/application/provision-personal-workspace"
import { findWorkspaceAccess } from "@/features/workspaces/infrastructure/workspace-access-repository"
import { clearReminderFixtures } from "@/test/clear-reminder-fixtures"

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const integrationDescribe = testDatabaseUrl
  ? describe.sequential
  : describe.skip

async function createMember(
  database: Database,
  name: string,
  workspaceId?: string,
): Promise<AccessContext> {
  const userId = randomUUID()
  await database.insert(users).values({
    email: `group-${userId}@example.com`,
    id: userId,
    name,
  })
  const authorizedWorkspaceId =
    workspaceId ??
    (await provisionPersonalWorkspace(database, {
      id: userId,
      name,
    }))
  if (workspaceId) {
    await database.insert(workspaceMembers).values({
      role: "member",
      userId,
      workspaceId,
    })
  }
  const access = await findWorkspaceAccess(database, {
    userId,
    workspaceId: authorizedWorkspaceId,
  })
  if (!access) throw new Error("Expected Group Study workspace access")
  return access
}

integrationDescribe("Group Study timer isolation", () => {
  const dashboardAt = new Date("2026-08-20T12:00:00.000Z")
  let database: Database
  let first: AccessContext
  let second: AccessContext

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
    first = await createMember(database, "Ada Lovelace")
    second = await createMember(database, "Grace Hopper")
  })

  afterAll(async () => {
    if (database) await database.$client.end({ timeout: 2 })
  })

  it("keeps participant timers independent and closes after the final leave", async () => {
    const startedAt = new Date("2026-08-20T10:00:00.000Z")
    const created = await createGroupStudySession(
      database,
      first,
      {
        name: "Compiler crew",
        participantLimit: 8,
        subject: "Compiler design",
      },
      startedAt,
    )
    const joinedRaw = await joinGroupStudySession(
      database,
      second,
      created.joinCode,
      new Date("2026-08-20T10:00:01.000Z"),
    )
    if (joinedRaw.status !== "joined")
      throw new Error("Expected joined, got pending")
    const joined = joinedRaw

    await expect(
      getTimerDashboard(first, database, dashboardAt),
    ).resolves.toMatchObject({
      sharedSession: {
        joinCode: created.joinCode,
        name: "Compiler crew",
        participants: [{ name: "Ada Lovelace" }, { name: "Grace Hopper" }],
      },
    })

    const paused = await pauseTimer(
      database,
      first,
      {
        expectedVersion: created.timerVersion,
        sessionId: created.timerSessionId,
      },
      new Date("2026-08-20T10:00:05.000Z"),
    )
    expect(paused).toMatchObject({ accumulatedMs: 5_000, status: "paused" })

    const secondWhileFirstPaused = await getTimerDashboard(
      second,
      database,
      dashboardAt,
    )
    expect(secondWhileFirstPaused.activeSession?.status).toBe("running")
    expect(
      secondWhileFirstPaused.sharedSession?.participants.find(
        (participant) => participant.userId === first.userId,
      )?.status,
    ).toBe("paused")
    expect(secondWhileFirstPaused.sharedSession?.activities[0]).toMatchObject({
      action: "paused",
      name: "Ada Lovelace",
      occurredAt: "2026-08-20T10:00:05.000Z",
    })

    const resumed = await resumeTimer(
      database,
      first,
      { expectedVersion: paused.version, sessionId: paused.id },
      new Date("2026-08-20T10:00:07.000Z"),
    )
    expect(resumed).toMatchObject({ accumulatedMs: 5_000, status: "running" })

    const firstStopped = await stopTimer(
      database,
      first,
      { expectedVersion: resumed.version, sessionId: resumed.id },
      new Date("2026-08-20T10:00:09.000Z"),
    )
    expect(firstStopped).toMatchObject({
      accumulatedMs: 7_000,
      status: "completed",
    })
    const firstAfterLeave = await getTimerDashboard(
      first,
      database,
      dashboardAt,
    )
    expect(firstAfterLeave.sharedSession).toBeNull()
    expect(firstAfterLeave.sharedHistory[0]).toMatchObject({
      subject: "Compiler design",
    })
    expect(firstAfterLeave.sharedHistory[0]?.activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "paused", name: "Ada Lovelace" }),
        expect.objectContaining({ action: "resumed", name: "Ada Lovelace" }),
        expect.objectContaining({ action: "left", name: "Ada Lovelace" }),
      ]),
    )

    const roomForSecond = (
      await getTimerDashboard(second, database, dashboardAt)
    ).sharedSession
    expect(roomForSecond?.participants).toHaveLength(1)
    expect(roomForSecond?.participants[0]?.name).toBe("Grace Hopper")
    expect(roomForSecond?.activities[0]).toMatchObject({
      action: "left",
      name: "Ada Lovelace",
    })
    await expect(
      setGroupStudyJoinLocked(database, first, {
        joinLocked: true,
        roomId: created.roomId,
      }),
    ).rejects.toThrow("active room host")

    await stopTimer(
      database,
      second,
      {
        expectedVersion: joined.timerVersion,
        sessionId: joined.timerSessionId,
      },
      new Date("2026-08-20T10:00:11.000Z"),
    )

    await expect(
      getTimerDashboard(second, database, dashboardAt),
    ).resolves.toMatchObject({
      activeSession: null,
      sharedHistory: [
        {
          durationMs: 11_000,
          name: "Compiler crew",
          participants: [
            { name: "Ada Lovelace", totalMs: 7_000 },
            { name: "Grace Hopper", totalMs: 10_000 },
          ],
          totalFocusMs: 17_000,
        },
      ],
      sharedSession: null,
    })
    await expect(
      database
        .select({ status: groupStudySessions.status })
        .from(groupStudySessions)
        .where(eq(groupStudySessions.id, created.roomId)),
    ).resolves.toEqual([{ status: "closed" }])
    await expect(database.select().from(activityEvents)).resolves.toHaveLength(
      0,
    )
  })

  it("enforces host controls, room capacity, regenerated codes, and blocks", async () => {
    const third = await createMember(database, "Katherine Johnson")
    const startedAt = new Date("2026-08-20T10:00:00.000Z")
    const created = await createGroupStudySession(
      database,
      first,
      {
        name: "Systems lab",
        participantLimit: 2,
        subject: "Operating systems",
      },
      startedAt,
    )
    await joinGroupStudySession(
      database,
      second,
      created.joinCode,
      new Date("2026-08-20T10:00:01.000Z"),
    )

    await expect(
      joinGroupStudySession(
        database,
        third,
        created.joinCode,
        new Date("2026-08-20T10:00:02.000Z"),
      ),
    ).rejects.toThrow("participant limit")
    await expect(
      setGroupStudyJoinLocked(database, second, {
        joinLocked: true,
        roomId: created.roomId,
      }),
    ).rejects.toThrow("do not have access to manage")

    await updateGroupStudySettings(database, first, {
      name: "Systems sprint",
      participantLimit: 3,
      roomId: created.roomId,
      subject: "Kernel scheduling",
    })
    await setGroupStudyJoinLocked(database, first, {
      joinLocked: true,
      roomId: created.roomId,
    })
    // A locked room converts an unapproved join into a pending request.
    await expect(
      joinGroupStudySession(
        database,
        third,
        created.joinCode,
        new Date("2026-08-20T10:00:03.000Z"),
      ),
    ).resolves.toMatchObject({ status: "pending", roomId: created.roomId })
    await setGroupStudyJoinLocked(database, first, {
      joinLocked: false,
      roomId: created.roomId,
    })

    const regenerated = await regenerateGroupStudyJoinCode(
      database,
      first,
      created.roomId,
    )
    expect(regenerated.joinCode).not.toBe(created.joinCode)
    await expect(
      joinGroupStudySession(
        database,
        third,
        created.joinCode,
        new Date("2026-08-20T10:00:04.000Z"),
      ),
    ).rejects.toThrow("not active")
    await joinGroupStudySession(
      database,
      third,
      regenerated.joinCode,
      new Date("2026-08-20T10:00:05.000Z"),
    )

    const active = (await getTimerDashboard(first, database, dashboardAt))
      .sharedSession
    const secondParticipant = active?.participants.find(
      (participant) => participant.userId === second.userId,
    )
    const thirdParticipant = active?.participants.find(
      (participant) => participant.userId === third.userId,
    )
    expect(active).toMatchObject({
      isHost: true,
      joinLocked: false,
      name: "Systems sprint",
      participantLimit: 3,
      subject: "Kernel scheduling",
    })
    if (!secondParticipant || !thirdParticipant) {
      throw new Error("Expected both joined participants")
    }

    await moderateGroupStudyParticipant(database, first, {
      action: "blocked",
      participantId: secondParticipant.id,
      roomId: created.roomId,
    })
    await expect(
      joinGroupStudySession(
        database,
        second,
        regenerated.joinCode,
        new Date("2026-08-20T10:00:06.000Z"),
      ),
    ).rejects.toThrow("blocked from this Group Study room")

    await moderateGroupStudyParticipant(database, first, {
      action: "removed",
      participantId: thirdParticipant.id,
      roomId: created.roomId,
    })
    await expect(
      joinGroupStudySession(
        database,
        third,
        regenerated.joinCode,
        new Date("2026-08-20T10:00:07.000Z"),
      ),
    ).resolves.toMatchObject({ roomId: created.roomId })

    const roomAfterModeration = (
      await getTimerDashboard(first, database, dashboardAt)
    ).sharedSession
    expect(roomAfterModeration?.activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "blocked", name: "Grace Hopper" }),
        expect.objectContaining({
          action: "removed",
          name: "Katherine Johnson",
        }),
      ]),
    )
  })

  it("completes a locked-room approval end to end and consumes the grant once", async () => {
    const startedAt = new Date("2026-08-20T11:00:00.000Z")
    const created = await createGroupStudySession(
      database,
      first,
      {
        name: "Locked seminar",
        participantLimit: 5,
        subject: "Distributed systems",
      },
      startedAt,
    )
    await setGroupStudyJoinLocked(database, first, {
      joinLocked: true,
      roomId: created.roomId,
    })

    // Joining a locked room without approval queues a pending request.
    await expect(
      joinGroupStudySession(
        database,
        second,
        created.joinCode,
        new Date("2026-08-20T11:00:01.000Z"),
      ),
    ).resolves.toMatchObject({ status: "pending", roomId: created.roomId })
    // The latest request is still pending, so no duplicate is created.
    await expect(
      joinGroupStudySession(
        database,
        second,
        created.joinCode,
        new Date("2026-08-20T11:00:02.000Z"),
      ),
    ).resolves.toMatchObject({ status: "pending" })

    const requests = await findPendingJoinRequestsForRoom(
      database,
      created.roomId,
    )
    const request = requests.find(
      (candidate) => candidate.userId === second.userId,
    )
    if (!request) throw new Error("Expected a pending join request")

    await respondToJoinRequest(database, first, {
      action: "approve",
      requestId: request.id,
      roomId: created.roomId,
    })

    // The approved participant can now complete the join.
    const joined = await joinGroupStudySession(
      database,
      second,
      created.joinCode,
      new Date("2026-08-20T11:00:03.000Z"),
    )
    expect(joined.status).toBe("joined")

    // The grant was consumed inside the joining transaction.
    const [consumed] = await database
      .select()
      .from(groupStudyJoinRequests)
      .where(eq(groupStudyJoinRequests.id, request.id))
    expect(consumed).toBeUndefined()

    // A participant cannot replay the flow to start a second timer. The
    // active-timer guard runs before the participation guard.
    await expect(
      joinGroupStudySession(
        database,
        second,
        created.joinCode,
        new Date("2026-08-20T11:00:04.000Z"),
      ),
    ).rejects.toThrow("Finish your current timer")
  })

  it("uses the join code as a cross-workspace grant without exposing the room by id", async () => {
    const outsider = await createMember(database, "Margaret Hamilton")
    const created = await createGroupStudySession(
      database,
      first,
      {
        name: "Workspace room",
        participantLimit: 8,
        subject: "Authorization boundaries",
      },
      new Date("2026-08-20T10:00:00.000Z"),
    )

    await expect(
      getTimerDashboard(outsider, database, dashboardAt),
    ).resolves.toMatchObject({ activeSession: null, sharedSession: null })
    await expect(
      findGroupStudySessionRecord(database, outsider, created.roomId),
    ).resolves.toBeNull()

    await expect(
      joinGroupStudySession(
        database,
        outsider,
        created.joinCode,
        new Date("2026-08-20T10:00:01.000Z"),
      ),
    ).resolves.toMatchObject({ roomId: created.roomId })
    await expect(
      getTimerDashboard(outsider, database, dashboardAt),
    ).resolves.toMatchObject({
      sharedSession: {
        id: created.roomId,
        participants: [{ name: "Ada Lovelace" }, { name: "Margaret Hamilton" }],
      },
    })
  })

  it("rejects a stale access context after workspace membership is revoked", async () => {
    const created = await createGroupStudySession(database, first, {
      name: "Revocation room",
      participantLimit: 8,
      subject: "Authorization lifecycle",
    })

    await database
      .update(workspaceMembers)
      .set({ deletedAt: new Date("2026-08-20T10:05:00.000Z") })
      .where(
        and(
          eq(workspaceMembers.userId, first.userId),
          eq(workspaceMembers.workspaceId, first.workspaceId),
        ),
      )

    await expect(
      getTimerDashboard(first, database, dashboardAt),
    ).resolves.toMatchObject({ activeSession: null, sharedSession: null })
    await expect(
      setGroupStudyJoinLocked(database, first, {
        joinLocked: true,
        roomId: created.roomId,
      }),
    ).rejects.toThrow("Workspace access is no longer active")
  })
})
